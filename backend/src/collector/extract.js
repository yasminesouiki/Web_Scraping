// Fonctions d'extraction "pures" (sans téléchargement ni HTML) : faciles à tester
const { cleanText, normalizeText, normalizePhone, titleCase, unique } = require('../utils/normalize');

const BUSINESS_TYPES = /(LocalBusiness|Organization|Corporation|Store|ProfessionalService|Restaurant|Hotel|MedicalBusiness|FinancialService)/i;

/** Transforme une adresse JSON-LD (texte ou objet) en une ligne lisible. */
function formatLdAddress(address) {
  if (!address) return '';
  if (typeof address === 'string') return cleanText(address);
  if (Array.isArray(address)) return formatLdAddress(address[0]);
  const country = typeof address.addressCountry === 'object' ? address.addressCountry?.name : address.addressCountry;
  return cleanText(
    [address.streetAddress, address.postalCode, address.addressLocality, country].filter(Boolean).join(', ')
  );
}

/**
 * Lit les blocs <script type="application/ld+json"> d'une page (données structurées
 * que beaucoup d'annuaires publient pour Google) et retourne les infos de l'entreprise.
 * @param {string[]} jsonStrings  contenu brut des balises script
 */
function extractJsonLd(jsonStrings) {
  const objects = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    objects.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  for (const raw of jsonStrings || []) {
    try {
      visit(JSON.parse(raw));
    } catch {
      // JSON invalide : on ignore ce bloc
    }
  }

  const business =
    objects.find((o) => BUSINESS_TYPES.test(String(o['@type'] || '')) && (o.telephone || o.address)) ||
    objects.find((o) => o.telephone || o.address) ||
    null;
  if (!business) return null;

  const addr = Array.isArray(business.address) ? business.address[0] : business.address;
  return {
    name: cleanText(business.name),
    telephone: Array.isArray(business.telephone) ? business.telephone.join(' / ') : cleanText(business.telephone),
    email: cleanText(String(business.email || '').replace(/^mailto:/i, '')),
    url: cleanText(business.url),
    address: formatLdAddress(addr),
    locality: cleanText(typeof addr === 'object' ? addr?.addressLocality : ''),
  };
}

/** Numéros précédés de "Tel", "Tél", "Gsm", "Mobile"... dans un texte. */
function findPhonesInText(text) {
  const re = /(?:t[ée]l(?:[ée]phone)?|gsm|mobile|portable|cel(?:l)?)\.?\s*:?\s*((?:\+|00)?\d[\d\s.\-()]{6,20}\d)/gi;
  const found = [];
  let m;
  while ((m = re.exec(String(text || ''))) !== null) found.push(normalizePhone(m[1]));
  return unique(found);
}

/** Adresses email présentes dans un texte (hors adresses techniques du site). */
function findEmailsInText(text, excludedDomains = ['goafricaonline.com']) {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return unique(
    matches
      .map((e) => e.toLowerCase())
      .filter((e) => !excludedDomains.some((d) => e.endsWith('@' + d) || e.endsWith('.' + d)))
      .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/(example|sentry|wixpress)/.test(e))
  );
}

/**
 * Déduit la ville d'une adresse, par exemple :
 *   "... - BP 350 Conakry - Guinée"                                  -> Conakry
 *   "34 Rue de La Palestine, Gouvernorat de Tunis, Tunis - 1002 - Tunisia" -> Tunis
 * On cherche le segment juste avant le pays, en sautant les codes postaux et "BP 123".
 * @param {string} address
 * @param {string|string[]} countryNames  nom(s) du pays (français / anglais)
 */
function cityFromAddress(address, countryNames) {
  const names = (Array.isArray(countryNames) ? countryNames : [countryNames]).map(normalizeText).filter(Boolean);
  const segments = String(address || '').split(/\s+-\s+|,\s*|\n+/).map(cleanText).filter(Boolean);
  if (!segments.length || !names.length) return '';

  const isCountry = (s) => {
    const n = normalizeText(s);
    return names.some((c) => n === c || n.endsWith(' ' + c) || n === c.split(' ').pop());
  };
  let i = segments.findIndex(isCountry) - 1;
  while (i >= 0) {
    const candidate = cleanText(
      segments[i].replace(/\b(?:B\.?\s?P\.?|BP)\s*[\d\s]+/gi, ' ').replace(/\b\d+\b/g, ' ')
    );
    if (candidate) {
      const words = candidate.split(' ').length;
      return candidate.length <= 40 && words <= 4 ? titleCase(candidate) : '';
    }
    i--; // segment vide (code postal seul) : on remonte d'un cran
  }
  return '';
}

/** Vrai si le lien pointe vers un autre site que le site source. */
function isExternalUrl(href, sourceHost) {
  try {
    const u = new URL(href);
    return /^https?:$/.test(u.protocol) && !u.hostname.endsWith(sourceHost.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

/** Certains sites passent par une redirection : /redirect?url=https%3A%2F%2F... */
function unwrapRedirect(href) {
  try {
    const u = new URL(href);
    for (const key of ['url', 'u', 'target', 'link', 'redirect']) {
      const value = u.searchParams.get(key);
      if (value && /^https?:\/\//i.test(value)) return value;
    }
  } catch {
    // lien relatif ou invalide
  }
  return href;
}

/**
 * La ville doit apparaître comme un MOT ENTIER à la FIN de l'adresse web de la fiche,
 * qui se termine toujours par "...-ville-pays" :
 *   "...-ariana-tunis-tunisie"            + "tunis" -> oui
 *   "...-la-marsa-tunisie"                + "tunis" -> non ("tunisie" n'est pas "tunis")
 *   "tunis-informatique-...-sfax-tunisie" + "tunis" -> non (Tunis est dans le NOM, pas la ville)
 */
function slugHasCity(slug, citySlug) {
  if (!citySlug) return true;
  const tokens = String(slug || '').toLowerCase().split('-').filter(Boolean);
  const cityTokens = citySlug.split('-').length;
  const tail = tokens.slice(-(cityTokens + 3)).join('-');
  return `-${tail}-`.includes(`-${citySlug}-`);
}

const SOCIAL = /(facebook|twitter|x\.com|instagram|linkedin|youtube|tiktok|whatsapp|wa\.me|google\.|apple\.com|play\.google)/i;

module.exports = {
  extractJsonLd,
  formatLdAddress,
  findPhonesInText,
  findEmailsInText,
  cityFromAddress,
  isExternalUrl,
  unwrapRedirect,
  slugHasCity,
  SOCIAL,
};