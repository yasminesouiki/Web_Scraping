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

const categoriesCache = new Map(); // code pays -> secteurs (gardés en mémoire)

async function getCategories(countryCode, fetcher = fetchHtml) {
  if (categoriesCache.has(countryCode)) return categoriesCache.get(countryCode);
  const html = await fetcher(`${config.collector.baseUrl}/${countryCode}/annuaire`);
  const categories = parseCategories(html, countryCode, config.collector.baseUrl);
  if (!categories.length) {
    throw new CollectorError(
      "Aucun secteur trouvé sur la page annuaire : la structure du site a peut-être changé (voir collector/parser.js).",
      502,
      'PARSE_ERROR'
    );
  }
  categoriesCache.set(countryCode, categories);
  return categories;
}

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
  const deadline = Date.now() + secondsLimit * 1000;
  const timeLeft = () => Date.now() < deadline;
  let partial = false;

  // 1. Secteurs correspondant au mot-clé
  log(onProgress, `Recherche des secteurs pour « ${keyword} » (${c.name})...`);
  const fetchPage = (url) => fetchBefore(url, deadline);
  let categories;
  try {
    categories = await getCategories(c.code, fetchPage);
  } catch (err) {
    if (err.code !== TIME_UP) throw err;
    return { country: c, partial: true, categories: [], companies: [], errors: [], message: 'Le site source est trop lent : réessayez dans un instant.' };
  }
  const sources = matchCategories(categories, keyword, config.collector.maxCategories).map((cat) => ({
    label: cat.label,
    url: cat.url,
  }));

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
  //  ⚠️ Une page de SECTEUR (ex. "Informatique, internet") ne liste pas d'entreprises,
  //     seulement des sous-catégories (ex. "Maintenance informatique", "Consultants informatiques").
  //     Dans ce cas, on ajoute ces sous-catégories à la file d'attente.
  const seen = new Set();
  const candidates = [];
  const queue = [...sources];
  const visitedSources = new Set(queue.map((s) => s.url));
  let addedSubcategories = 0;

  outer: while (queue.length) {
    const source = queue.shift();
    for (let page = 1; page <= pagesLimit; page++) {
      const separator = source.url.includes('?') ? '&' : '?';
      const pageUrl = page === 1 ? source.url : `${source.url}${separator}p=${page}`;
      if (!timeLeft()) {
        partial = true;
        log(onProgress, 'Limite de temps atteinte : on garde les résultats trouvés.');
        break outer;
      }
      log(onProgress, `Lecture de la liste : ${pageUrl}`);

      let html;
      try {
        html = await fetchPage(pageUrl);
      } catch (err) {
        if (err.code === 'NOT_FOUND') break; // plus de pages
        if (err.code === TIME_UP) {
          partial = true;
          log(onProgress, 'Limite de temps atteinte : on garde les résultats trouvés.');
          break outer;
        }
        if (candidates.length) {
          // une page en erreur ne doit pas faire perdre les entreprises déjà trouvées
          partial = true;
          break outer;
        }
        throw err;
      }
      const links = parseListing(html, c.code, baseUrl, countryNames);

      // Page de secteur sans entreprises -> on descend dans ses sous-catégories
      if (page === 1 && links.length === 0) {
        const subcategories = parseCategories(html, c.code, baseUrl).filter((s) => !visitedSources.has(s.url));
        const relevant = matchCategories(subcategories, keyword, subcategories.length);
        const chosen = (relevant.length ? relevant : subcategories).slice(
          0,
          Math.max(0, subcategoriesLimit - addedSubcategories)
        );
        for (const sub of chosen) {
          visitedSources.add(sub.url);
          queue.push({ label: sub.label, url: sub.url });
        }
        addedSubcategories += chosen.length;
        if (chosen.length) {
          log(onProgress, `« ${source.label} » est un secteur : ${chosen.length} sous-catégorie(s) ajoutée(s) (${chosen.map((s) => s.label).join(', ')})`);
        }
        break;
      }

      let newLinks = 0;
      for (const link of links) {
        if (seen.has(link.id)) continue;
        seen.add(link.id);
        newLinks++;
        // la ville apparaît dans l'adresse de la fiche : ...-dakar-senegal (mot entier)
        if (!slugHasCity(link.slug, citySlug)) continue;
        candidates.push({ ...link, sector: source.label });
        if (candidates.length >= companiesLimit) break outer;
      }
      if (newLinks === 0) break; // page vide ou identique : fin de la liste
    }
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

module.exports = { collect, getCategories };