// Lecture du HTML des pages du site source (avec Cheerio, un "jQuery côté serveur").
//
// ⚠️ Si le site change sa présentation, c'est CE fichier qu'il faut adapter.
//    Tous les repères (sélecteurs) sont regroupés dans l'objet SELECTORS ci-dessous.
const cheerio = require('cheerio');
const { cleanText, normalizeText, normalizePhone, titleCase, unique } = require('../utils/normalize');
const {
  extractJsonLd,
  findPhonesInText,
  findEmailsInText,
  cityFromAddress,
  isExternalUrl,
  unwrapRedirect,
  SOCIAL,
} = require('./extract');

const SELECTORS = {
  // Données structurées publiées pour les moteurs de recherche
  jsonLd: 'script[type="application/ld+json"]',
  // Fiche entreprise
  name: ['h1', '[itemprop="name"]'],
  ogTitle: 'meta[property="og:title"]',
  phoneLinks: 'a[href^="tel:"]',
  emailLinks: 'a[href^="mailto:"]',
  address: ['[itemprop="address"]', '[itemprop="streetAddress"]', 'address'],
  websiteLinks: 'a[href]',
  websiteLabel: /site\s*(web|internet)|website/i,
  contactBlockLabel: /^coordonnees$/,
};

/** Retourne le chemin d'un lien s'il appartient au site source, sinon null. */
function toSourcePath(href, baseUrl) {
  try {
    const u = new URL(href, baseUrl);
    const base = new URL(baseUrl);
    if (u.hostname !== base.hostname) return null;
    return u.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Page "annuaire" d'un pays -> liste des secteurs.
 * Les liens ressemblent à : /sn/annuaire/agences-de-communication
 */
function parseCategories(html, countryCode, baseUrl) {
  const $ = cheerio.load(html);
  const re = new RegExp(`^/${countryCode}/annuaire/([a-z0-9-]+)$`, 'i');
  const bySlug = new Map();

  $('a[href]').each((_, a) => {
    const path = toSourcePath($(a).attr('href'), baseUrl);
    const m = path && path.match(re);
    if (!m) return;
    const slug = m[1].toLowerCase();
    const label = cleanText($(a).attr('title') || $(a).text()) || slug.replace(/-/g, ' ');
    const current = bySlug.get(slug);
    // on garde le libellé le plus parlant
    if (!current || (label.length > current.label.length && label.length < 80)) {
      bySlug.set(slug, { slug, label, url: `${baseUrl}/${countryCode}/annuaire/${slug}` });
    }
  });
  return [...bySlug.values()];
}

/**
 * Page de liste d'un secteur -> entreprises.
 * Les fiches ressemblent à : /sn/842373-dican-agences-communication-dakar-senegal
 *
 * Pour aller VITE, on lit directement la "carte" de chaque entreprise dans la liste
 * (nom, secteur, adresse, téléphone), sans ouvrir sa fiche.
 */
function parseListing(html, countryCode, baseUrl, countryNames = []) {
  const $ = cheerio.load(html);
  const re = new RegExp(`^/${countryCode}/(\\d+)-([a-z0-9-]+)$`, 'i');
  const byId = new Map();

  const companyIdOf = (a) => {
    const path = toSourcePath($(a).attr('href'), baseUrl);
    const m = path && path.match(re);
    return m ? { id: m[1], slug: m[2].toLowerCase(), path } : null;
  };

  $('a[href]').each((_, a) => {
    const info = companyIdOf(a);
    if (!info) return;
    const name = cleanText($(a).text());
    const existing = byId.get(info.id);
    if (!existing) {
      byId.set(info.id, { id: info.id, slug: info.slug, url: `${baseUrl}${info.path}`, name, anchor: a });
    } else if (!existing.name && name) {
      existing.name = name;
    }
  });

  return [...byId.values()].map(({ anchor, ...item }) => ({
    ...item,
    card: readCard($, findCard($, anchor, companyIdOf), item, countryCode, baseUrl, countryNames),
  }));
}

/** Remonte depuis le lien jusqu'au plus grand bloc qui ne concerne QU'UNE entreprise. */
function findCard($, anchor, companyIdOf) {
  let card = $(anchor);
  for (let depth = 0; depth < 8; depth++) {
    const parent = card.parent();
    if (!parent.length || parent.is('body, html')) break;
    const ids = new Set();
    parent.find('a[href]').each((_, x) => {
      const info = companyIdOf(x);
      if (info) ids.add(info.id);
    });
    if (ids.size > 1) break; // le parent contient plusieurs entreprises : on s'arrête
    card = parent;
  }
  return card;
}

const STATUS_WORDS = /^(ouvert|ferm[ée]|open|closed|ouvre|opens)\b/i;

/** Lit nom, secteur, adresse et téléphone dans la carte d'une entreprise. */
function readCard($, card, item, countryCode, baseUrl, countryNames) {
  const sourceHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  const name = cleanText(card.find('h1, h2, h3, h4').first().text()) || item.name;
  const sector = cleanText(card.find(`a[href*="/${countryCode}/annuaire/"]`).first().text());

  const phones = unique([
    ...card.find('a[href^="tel:"]').map((_, a) => normalizePhone(($(a).attr('href') || '').replace(/^tel:/i, ''))).get(),
    ...findPhonesInText(card.text()),
  ]);
  const emails = unique([
    ...card.find('a[href^="mailto:"]').map((_, a) => ($(a).attr('href') || '').replace(/^mailto:/i, '').split('?')[0].toLowerCase()).get(),
    ...findEmailsInText(card.text(), [sourceHost]),
  ]);

  // Adresse : les lignes qui précèdent la ligne contenant le pays ("Tunis - 1002 - Tunisia")
  const parts = textParts($, card).split(', ');
  const names = countryNames.filter(Boolean).map(normalizeText);
  const countryIdx = parts.findIndex((p) => names.some((c) => normalizeText(p).endsWith(c)));
  let address = '';
  if (countryIdx >= 0) {
    const lines = [];
    for (let i = countryIdx; i >= 0 && lines.length < 4; i--) {
      const line = parts[i];
      if (line === name || line === sector || line === item.name || STATUS_WORDS.test(line)) break;
      if (/^(t[ée]l|gsm|mobile|fax)\b/i.test(line)) continue;
      lines.unshift(line);
    }
    address = lines.join(', ');
  }

  return {
    name,
    sector,
    address,
    city: cityFromAddress(address, countryNames),
    phone: phones.slice(0, 3).join(' / '),
    email: emails.slice(0, 2).join(' / '),
  };
}

/** Texte d'un bloc en gardant la séparation des lignes : "Rue X, Gouvernorat de Tunis, Tunis - 1002 - Tunisia" */
function textParts($, el) {
  const parts = [];
  $(el)
    .find('*')
    .addBack()
    .contents()
    .each((_, node) => {
      if (node.type !== 'text') return;
      const t = cleanText(node.data);
      if (t && /[\p{L}\d]/u.test(t)) parts.push(t);
    });
  return parts.join(', ');
}

function firstParts($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = textParts($, el);
      if (text) return text;
    }
  }
  return '';
}

function firstText($, selectors) {
  for (const sel of selectors) {
    const text = cleanText($(sel).first().text());
    if (text) return text;
  }
  return '';
}

/** Texte du bloc "Coordonnées" (utile si l'adresse n'est pas balisée). */
function contactBlockText($) {
  let result = '';
  $('h2, h3, h4, h5, strong, b, span, div, p').each((_, el) => {
    if (result) return;
    const own = normalizeText($(el).clone().children().remove().end().text());
    if (SELECTORS.contactBlockLabel.test(own)) {
      result = textParts($, $(el).parent()).replace(/coordonn[ée]es,?\s*/i, '').trim();
    }
  });
  // on coupe avant les numéros / boutons
  return cleanText(result.split(/\b(?:t[ée]l|gsm|mobile|fax|email|site web|itin[ée]raire)\b/i)[0])
    .replace(/[,\s]+$/, '')
    .slice(0, 300);
}

/**
 * Fiche entreprise -> objet avec tous les champs demandés.
 * Ordre de priorité : données structurées (JSON-LD) > balises dédiées > texte de la page.
 */
function parseCompanyPage(html, { url, baseUrl, countryName, countryNameEn, sector, fallbackName, searchedCity }) {
  const $ = cheerio.load(html);
  const sourceHost = new URL(baseUrl).hostname;
  const ld = extractJsonLd($(SELECTORS.jsonLd).map((_, el) => $(el).contents().text()).get()) || {};
  const pageText = cleanText($('body').text());

  // Nom
  const ogTitle = cleanText(($(SELECTORS.ogTitle).attr('content') || '').split(/\s[-|–]\s/)[0]);
  const name = ld.name || firstText($, SELECTORS.name) || ogTitle || fallbackName || '';

  // Téléphone(s)
  const phoneFromLinks = $(SELECTORS.phoneLinks)
    .map((_, a) => normalizePhone(decodeURIComponent(($(a).attr('href') || '').replace(/^tel:/i, ''))))
    .get();
  let phones = unique([normalizePhone(ld.telephone), ...phoneFromLinks]);
  if (!phones.length) phones = findPhonesInText(pageText);

  // Email(s)
  const emailFromLinks = $(SELECTORS.emailLinks)
    .map((_, a) => ($(a).attr('href') || '').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase())
    .get();
  let emails = unique([ld.email && ld.email.toLowerCase(), ...emailFromLinks]).filter(
    (e) => !e.endsWith('@' + sourceHost.replace(/^www\./, ''))
  );
  if (!emails.length) emails = findEmailsInText(pageText, [sourceHost.replace(/^www\./, '')]);

  // Site internet
  let website = ld.url && isExternalUrl(ld.url, sourceHost) ? ld.url : '';
  if (!website) {
    $(SELECTORS.websiteLinks).each((_, a) => {
      if (website) return;
      const label = `${$(a).text()} ${$(a).attr('title') || ''} ${$(a).attr('aria-label') || ''}`;
      if (!SELECTORS.websiteLabel.test(label)) return;
      let href;
      try {
        href = unwrapRedirect(new URL($(a).attr('href'), url).toString());
      } catch {
        return; // lien invalide
      }
      if (isExternalUrl(href, sourceHost) && !SOCIAL.test(href)) website = href;
    });
  }

  // Adresse et ville
  const address = ld.address || firstParts($, SELECTORS.address) || contactBlockText($);
  let city = ld.locality || cityFromAddress(address, [countryName, countryNameEn]);
  if (!city && searchedCity) city = titleCase(searchedCity);

  return {
    name: cleanText(name),
    sector: cleanText(sector),
    country: countryName,
    city: cleanText(city),
    address: cleanText(address),
    phone: phones.slice(0, 3).join(' / '),
    email: emails.slice(0, 2).join(' / '),
    website: cleanText(website),
    sourceUrl: url,
  };
}

module.exports = { parseCategories, parseListing, parseCompanyPage, SELECTORS };