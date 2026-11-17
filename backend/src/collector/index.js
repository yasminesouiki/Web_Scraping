// =============================================================
//  MODULE DE COLLECTE (indépendant de l'API et de l'interface)
//
//  collect({ country, keyword, city }) :
//    1. trouve le(s) secteur(s) du site correspondant au mot-clé
//    2. parcourt les pages de liste (?p=1, 2, 3...)
//    3. garde les entreprises de la ville demandée
//    4. lit les infos directement dans la liste (rapide) ; n'ouvre une fiche
//       que si les infos manquent ou si FETCH_DETAILS=true (email, site web)
//  Une limite de temps (MAX_COLLECT_SECONDS) garantit une réponse rapide.
//  Il ne connaît PAS la base de données : il retourne simplement une liste.
// =============================================================
const { config } = require('../config/env');
const { CollectorError } = require('../utils/errors');
const { slugify, titleCase } = require('../utils/normalize');
const { getCountry } = require('./countries');
const { fetchHtml } = require('./http');
const { parseCategories, parseListing, parseCompanyPage } = require('./parser');
const { matchCategories } = require('./matcher');
const { slugHasCity } = require('./extract');
const { getCategoryIndex, rememberCategories, isIndexComplete } = require('./categoryIndex');

const TIME_UP = 'TIME_UP';

/**
 * Télécharge une page SANS dépasser le temps restant :
 * si la page n'est pas arrivée à la fin du délai, on abandonne et on garde ce qu'on a.
 */
async function fetchBefore(url, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new CollectorError('Limite de temps atteinte.', 504, TIME_UP);
  let timer;
  try {
    return await Promise.race([
      fetchHtml(url, { retries: 0 }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CollectorError('Limite de temps atteinte.', 504, TIME_UP)), remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function log(onProgress, message) {
  if (typeof onProgress === 'function') onProgress(message);
}

/**
 * @param {object}  params
 * @param {string}  params.country   code ("sn") ou nom ("Sénégal")
 * @param {string}  params.keyword   secteur ou mot-clé ("informatique", "marketing"...)
 * @param {string}  [params.city]    ville (optionnelle)
 * @param {number}  [params.maxPages]
 * @param {number}  [params.maxCompanies]
 * @param {number}  [params.maxSeconds]        durée maximale de la collecte
 * @param {number}  [params.maxSubcategories]
 * @param {function}[params.onProgress]  callback pour afficher l'avancement
 */
async function collect({ country, keyword, city = '', maxPages, maxCompanies, maxSeconds, maxSubcategories, onProgress } = {}) {
  const c = getCountry(country);
  if (!c) throw new CollectorError(`Pays non pris en charge : "${country}"`, 400, 'BAD_COUNTRY');
  if (!keyword || !keyword.trim()) throw new CollectorError('Le mot-clé est obligatoire.', 400, 'BAD_KEYWORD');

  const baseUrl = config.collector.baseUrl;
  const pagesLimit = maxPages || config.collector.maxListingPages;
  const companiesLimit = maxCompanies || config.collector.maxCompanies;
  const citySlug = city ? slugify(city) : '';
  const countryNames = [c.name, c.nameEn];
  const secondsLimit = maxSeconds || config.collector.maxCollectSeconds;
  const subcategoriesLimit = maxSubcategories || config.collector.maxSubcategories;
  let partial = false;

  // 1. Catégories correspondant au mot-clé (index complet des catégories du site)
  log(onProgress, `Recherche des catégories pour « ${keyword} » (${c.name})...`);
  let categories;
  try {
    // La 1re fois pour un pays, l'index est construit (≈ 20 s, une seule fois, puis gardé sur disque)
    categories = await getCategoryIndex(c.code, {
      budgetMs: config.collector.indexBuildSeconds * 1000,
      onProgress,
    });
  } catch (err) {
    throw new CollectorError(`Impossible de lire l'annuaire du site source (${err.message}).`, 502, 'SOURCE_UNREACHABLE');
  }
  if (!isIndexComplete(c.code)) log(onProgress, 'Index des catégories encore incomplet : il sera complété aux prochaines recherches.');

  // le chrono de la collecte démarre maintenant
  const deadline = Date.now() + secondsLimit * 1000;
  const timeLeft = () => Date.now() < deadline;
  const fetchPage = (url) => fetchBefore(url, deadline);

  let sources = matchCategories(categories, keyword, config.collector.maxCategories).map((cat) => ({
    label: cat.label,
    url: cat.url,
    direct: cat.direct,
  }));

  // Rien trouvé et index pas encore complet -> on le complète (dans la limite de temps) et on réessaie
  if (!sources.length && !isIndexComplete(c.code)) {
    log(onProgress, "Catégorie pas encore connue : on complète l'index des catégories...");
    categories = await getCategoryIndex(c.code, { budgetMs: Math.max(0, deadline - Date.now()), onProgress });
    sources = matchCategories(categories, keyword, config.collector.maxCategories).map((cat) => ({
      label: cat.label,
      url: cat.url,
      direct: cat.direct,
    }));
  }

  // Option : recherche par nom via l'URL de recherche du site (si configurée)
  if (!sources.length && config.collector.searchUrlTemplate) {
    sources.push({
      label: keyword,
      url: config.collector.searchUrlTemplate
        .replace('{country}', c.code)
        .replace('{query}', encodeURIComponent(keyword)),
    });
  }

  if (!sources.length) {
    return {
      country: c,
      categories: [],
      companies: [],
      errors: [],
      message: `Aucun secteur du site ne correspond à « ${keyword} ».`,
    };
  }
  log(onProgress, `Secteur(s) retenu(s) : ${sources.map((s) => s.label).join(', ')}`);

  // 2-3. Parcours des pages de liste
  //  ⚠️ Une page de SECTEUR (ex. "Santé") ne liste pas d'entreprises, seulement des
  //     sous-catégories (ex. "Médecins ORL", "Cliniques", "Dentistes"...).
  //     On les ajoute à la file d'attente, puis on MÉLANGE les résultats de toutes les
  //     catégories (sinon 20 résultats = 20 médecins ORL de la 1re sous-catégorie).
  const seen = new Set();
  const queue = [...sources];
  const visitedSources = new Set(queue.map((s) => s.url));
  const perSource = []; // [{ source, links: [], nextPage, hasMore }]
  let addedSubcategories = 0;

  const readPage = async (entry, page) => {
    const separator = entry.source.url.includes('?') ? '&' : '?';
    const pageUrl = page === 1 ? entry.source.url : `${entry.source.url}${separator}p=${page}`;
    log(onProgress, `Lecture de la liste : ${pageUrl}`);
    let html;
    try {
      html = await fetchPage(pageUrl);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return { html: null, links: [] }; // plus de pages
      throw err;
    }
    return { html, links: parseListing(html, c.code, baseUrl, countryNames) };
  };

  const addLinks = (entry, links) => {
    let newLinks = 0;
    for (const link of links) {
      if (seen.has(link.id)) continue;
      seen.add(link.id);
      newLinks++;
      // la ville apparaît dans l'adresse de la fiche : ...-dakar-senegal (mot entier)
      if (!slugHasCity(link.slug, citySlug)) continue;
      entry.links.push({ ...link, sector: entry.source.label });
    }
    return newLinks;
  };

  const total = () => perSource.reduce((n, e) => n + e.links.length, 0);

  try {
    // Phase A : 1re page de chaque catégorie (et descente dans les secteurs)
    while (queue.length) {
      if (!timeLeft()) throw new CollectorError('Limite de temps atteinte.', 504, TIME_UP);
      // assez de résultats venant de plusieurs catégories : inutile d'en ouvrir d'autres
      if (total() >= companiesLimit * 2 && perSource.length >= 4) break;

      const source = queue.shift();
      const entry = { source, links: [], nextPage: 2, hasMore: false };
      const { html, links } = await readPage(entry, 1);
      if (!html) continue;

      if (links.length === 0) {
        // page de secteur -> sous-catégories liées au mot-clé
        const allSub = parseCategories(html, c.code, baseUrl);
        rememberCategories(c.code, allSub);
        const subcategories = allSub.filter((x) => !visitedSources.has(x.url));
        const relevant = matchCategories(subcategories, keyword, subcategories.length);
        // Le secteur correspond directement au mot-clé ("santé" -> secteur "Santé") :
        // toutes ses sous-catégories sont utiles (médecins, cliniques, dentistes...), les plus proches d'abord.
        // Sinon (secteur trouvé via un synonyme) : seulement les sous-catégories liées au mot-clé.
        const others = subcategories.filter((x) => !relevant.some((r) => r.slug === x.slug));
        const pool = source.direct || !relevant.length ? [...relevant, ...others] : relevant;
        const chosen = pool.slice(
          0,
          Math.max(0, subcategoriesLimit - addedSubcategories)
        );
        for (const sub of chosen) {
          visitedSources.add(sub.url);
          queue.push({ label: sub.label, url: sub.url });
        }
        addedSubcategories += chosen.length;
        if (chosen.length) {
          log(onProgress, `« ${source.label} » est un secteur : ${chosen.length} sous-catégorie(s) ajoutée(s) (${chosen.map((x) => x.label).join(', ')})`);
        }
        continue;
      }

      entry.hasMore = addLinks(entry, links) > 0 && pagesLimit > 1;
      perSource.push(entry);
    }

    // Phase B : pas assez de résultats -> pages suivantes, une catégorie après l'autre
    while (total() < companiesLimit && perSource.some((e) => e.hasMore)) {
      for (const entry of perSource) {
        if (!entry.hasMore || total() >= companiesLimit) continue;
        if (!timeLeft()) throw new CollectorError('Limite de temps atteinte.', 504, TIME_UP);
        const { links } = await readPage(entry, entry.nextPage);
        entry.nextPage++;
        entry.hasMore = links.length > 0 && addLinks(entry, links) > 0 && entry.nextPage <= pagesLimit;
      }
    }
  } catch (err) {
    if (err.code === TIME_UP) {
      partial = true;
      log(onProgress, 'Limite de temps atteinte : on garde les résultats trouvés.');
    } else if (total() === 0) {
      throw err;
    } else {
      partial = true; // une page en erreur ne doit pas faire perdre ce qui a été trouvé
    }
  }

  // Mélange équilibré : 1 entreprise de chaque catégorie à tour de rôle
  const candidates = [];
  for (let i = 0; candidates.length < companiesLimit; i++) {
    let added = false;
    for (const entry of perSource) {
      if (entry.links[i] && candidates.length < companiesLimit) {
        candidates.push(entry.links[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  log(onProgress, `${candidates.length} entreprise(s) repérée(s).`);

  // 4. Construction des résultats
  const companies = [];
  const errors = [];
  for (const [i, cand] of candidates.entries()) {
    const card = cand.card || {};
    const fromCard = {
      name: card.name || cand.name,
      sector: card.sector || cand.sector,
      country: c.name,
      countryCode: c.code,
      city: card.city || (citySlug ? titleCase(city) : ''),
      address: card.address || '',
      phone: card.phone || '',
      email: card.email || '',
      website: '',
      sourceUrl: cand.url,
    };
    const cardIsEnough = fromCard.name && (fromCard.phone || fromCard.address);

    let company = fromCard;
    // On n'ouvre la fiche que si nécessaire, et seulement s'il reste du temps
    if ((config.collector.fetchDetails || !cardIsEnough) && timeLeft()) {
      log(onProgress, `(${i + 1}/${candidates.length}) ouverture de la fiche : ${fromCard.name || cand.url}`);
      try {
        const html = await fetchPage(cand.url);
        const detail = parseCompanyPage(html, {
          url: cand.url,
          baseUrl,
          countryName: c.name,
          countryNameEn: c.nameEn,
          sector: fromCard.sector,
          fallbackName: fromCard.name,
          searchedCity: citySlug ? city : '',
        });
        // la fiche complète la carte sans écraser ce qui est déjà connu
        company = { ...fromCard };
        for (const key of ['name', 'city', 'address', 'phone', 'email', 'website']) {
          if (!company[key] && detail[key]) company[key] = detail[key];
        }
      } catch (err) {
        if (err.code === TIME_UP) partial = true;
        else errors.push({ url: cand.url, error: err.message });
      }
    } else if (!cardIsEnough && !timeLeft()) {
      partial = true;
    }

    if (company.name) companies.push(company);
  }

  let message = `${companies.length} entreprise(s) collectée(s).`;
  if (!candidates.length && citySlug && seen.size > 0) {
    message = `${seen.size} entreprise(s) trouvée(s) dans le secteur, mais aucune à « ${city} » (essayez sans ville ou une ville voisine).`;
  } else if (!candidates.length) {
    message = `Aucune entreprise trouvée dans les pages du secteur « ${sources.map((s) => s.label).join(', ')} ».`;
  }

  if (partial) message += ` Résultats partiels : limite de ${secondsLimit} s atteinte.`;

  return {
    country: c,
    partial,
    categories: sources.map((s) => s.label),
    companies,
    errors,
    message,
  };
}

module.exports = { collect };