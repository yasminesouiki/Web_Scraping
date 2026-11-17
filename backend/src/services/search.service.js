// =============================================================
//  LOGIQUE DE RECHERCHE (la base de données d'abord = affichage immédiat)
//  1a. La même recherche a déjà été faite        -> ses résultats, tout de suite
//  1b. Des entreprises correspondantes sont en base -> affichées tout de suite
//  2.  Sinon seulement -> collecte sur le site source, enregistrement sans doublons
//  3.  Si rien n'est trouvé ou si le site est injoignable -> base locale
// =============================================================
const { config } = require('../config/env');
const { AppError } = require('../utils/errors');
const { normalizeText, cleanText } = require('../utils/normalize');
const { getCountry } = require('../collector/countries');
const { collect } = require('../collector');
const companyModel = require('../models/company.model');
const searchModel = require('../models/search.model');

/** Enregistre une liste d'entreprises collectées. Utilisé par l'API et par la CLI. */
async function saveCollectedCompanies(companies) {
  const ids = [];
  let created = 0;
  for (const company of companies) {
    if (!company.name || !company.sourceUrl) continue;
    const res = await companyModel.upsertCompany(company);
    ids.push(res.id);
    if (res.created) created++;
  }
  return { ids, created, duplicates: ids.length - created };
}

function validate({ country, city, keyword }) {
  const c = getCountry(country);
  if (!c) throw new AppError('Veuillez choisir un pays valide.', 400, 'BAD_COUNTRY');
  const kw = cleanText(keyword);
  if (kw.length < 2) throw new AppError('Le mot-clé doit contenir au moins 2 caractères.', 400, 'BAD_KEYWORD');
  if (kw.length > 100) throw new AppError('Le mot-clé est trop long.', 400, 'BAD_KEYWORD');
  const ct = cleanText(city);
  if (ct.length > 100) throw new AppError('Le nom de ville est trop long.', 400, 'BAD_CITY');
  return { country: c, keyword: kw, city: ct };
}

/**
 * @param {{country:string, city?:string, keyword:string, refresh?:boolean}} input
 */
async function runSearch(input) {
  const { country, keyword, city } = validate(input);
  const keywordNormalized = normalizeText(keyword);
  const cityNormalized = normalizeText(city);

  // 1a. MÊME RECHERCHE DÉJÀ FAITE -> on réaffiche ses résultats immédiatement
  if (!input.refresh) {
    const previous = await searchModel.findRecentSearch({
      countryCode: country.code,
      keywordNormalized,
      cityNormalized,
      days: 36500, // pas de date limite : une recherche déjà faite reste instantanée
    });
    if (previous) {
      const companies = await searchModel.getSearchResults(previous.id);
      if (companies.length) {
        return {
          search: previous,
          source: 'cache',
          message: 'Résultats depuis la base de données.',
          stats: { found: companies.length, created: 0, duplicates: 0, errors: 0 },
          categories: [],
          companies,
        };
      }
    }

    // 1b. ENTREPRISES DÉJÀ EN BASE (nom, secteur ou synonymes + ville) -> affichage immédiat
    const local = await companyModel.searchLocal({ countryCode: country.code, city, keyword });
    if (local.length) {
      const searchId = await searchModel.createSearch({
        countryCode: country.code,
        country: country.name,
        city,
        cityNormalized,
        keyword,
        keywordNormalized,
      });
      await searchModel.linkResults(searchId, local.map((c) => c.id));
      await searchModel.finishSearch(searchId, {
        status: 'done',
        source: 'local',
        resultsCount: local.length,
        message: 'Résultats depuis la base de données.',
      });
      return {
        search: await searchModel.getSearchById(searchId),
        source: 'cache',
        message: 'Résultats depuis la base de données.',
        stats: { found: local.length, created: 0, duplicates: 0, errors: 0 },
        categories: [],
        companies: local,
      };
    }
  }

  // 2. Nouvelle recherche
  const searchId = await searchModel.createSearch({
    countryCode: country.code,
    country: country.name,
    city,
    cityNormalized,
    keyword,
    keywordNormalized,
  });

  let collected;
  let collectError = null;
  try {
    collected = await collect({ country: country.code, keyword, city });
  } catch (err) {
    collectError = err;
  }

  // 2a. Collecte réussie avec des résultats
  if (collected && collected.companies.length) {
    const stats = await saveCollectedCompanies(collected.companies);
    await searchModel.linkResults(searchId, stats.ids);
    const companies = await searchModel.getSearchResults(searchId);
    await searchModel.finishSearch(searchId, {
      status: 'done',
      source: 'live',
      resultsCount: companies.length,
      message: collected.message,
    });
    return {
      search: await searchModel.getSearchById(searchId),
      source: 'live',
      message: `Collecte terminée sur le site source (secteur : ${collected.categories.join(', ')}).`,
      stats: {
        found: companies.length,
        created: stats.created,
        duplicates: stats.duplicates,
        errors: collected.errors.length,
      },
      categories: collected.categories,
      companies,
    };
  }

  // 3. Rien collecté (aucun secteur / site injoignable) -> base locale
  const local = await companyModel.searchLocal({ countryCode: country.code, city, keyword });
  await searchModel.linkResults(searchId, local.map((c) => c.id));

  const reason = collectError ? collectError.message : collected.message;
  if (collectError && !local.length) {
    await searchModel.finishSearch(searchId, { status: 'failed', message: reason });
    throw collectError;
  }

  await searchModel.finishSearch(searchId, {
    status: 'done',
    source: 'local',
    resultsCount: local.length,
    message: reason,
  });
  return {
    search: await searchModel.getSearchById(searchId),
    source: 'local',
    message: local.length
      ? `${reason} Résultats trouvés dans la base locale (nom ou secteur).`
      : `${reason} Aucune entreprise correspondante dans la base locale non plus.`,
    stats: { found: local.length, created: 0, duplicates: 0, errors: 0 },
    categories: collected ? collected.categories : [],
    companies: local,
  };
}

module.exports = { runSearch, saveCollectedCompanies };