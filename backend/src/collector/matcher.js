// Association d'un mot-clé libre ("info", "marketing"...) aux secteurs du site
const { normalizeText } = require('../utils/normalize');

// Quelques équivalences utiles (à compléter librement)
const SYNONYMS = {
  info: ['informatique'],
  it: ['informatique'],
  tech: ['informatique'],
  web: ['internet', 'informatique'],
  digital: ['internet', 'communication'],
  marketing: ['marketing', 'communication', 'publicite'],
  pub: ['publicite'],
  commercial: ['commerce', 'distribution'],
  commerce: ['commerce'],
  resto: ['restaurant'],
  restauration: ['restaurant'],
  hotel: ['hotel', 'hotellerie'],
  banque: ['banque', 'banques'],
  assurance: ['assurance', 'assurances'],
  avocat: ['avocat', 'avocats'],
  comptable: ['comptable', 'expertise comptable'],
  transport: ['transport', 'transports', 'logistique'],
  btp: ['batiment', 'construction', 'btp'],
  sante: ['sante', 'clinique', 'medecin'],
  formation: ['formation', 'ecole'],
  immobilier: ['immobilier', 'agence immobiliere'],
};

function scoreLabel(label, slug, term) {
  const text = normalizeText(label);
  const slugText = normalizeText(slug);
  const words = new Set([...text.split(' '), ...slugText.split(' ')].filter(Boolean));
  const termWords = term.split(' ').filter(Boolean);

  if (text === term || slugText === term) return 100;
  if (termWords.length > 1 && termWords.every((w) => words.has(w))) return 80;
  if (text.startsWith(term + ' ')) return 75; // le secteur commence par le mot-clé
  if ([...words].some((w) => w === term)) return 70;
  if ([...words].some((w) => w.startsWith(term))) return 60;
  if (text.includes(term)) return 40;
  return 0;
}

/**
 * @param {Array<{slug:string,label:string,url:string}>} categories
 * @param {string} keyword
 * @param {number} max  nombre maximum de secteurs retournés
 */
function matchCategories(categories, keyword, max = 2) {
  const kw = normalizeText(keyword);
  if (!kw) return [];
  const terms = [kw, ...(SYNONYMS[kw] || []).map(normalizeText)];

  const scored = [];
  for (const cat of categories) {
    let best = 0;
    for (const term of terms) {
      // le mot-clé exact compte un peu plus que ses synonymes
      const s = scoreLabel(cat.label, cat.slug, term) - (term === kw ? 0 : 5);
      if (s > best) best = s;
    }
    if (best > 0) scored.push({ ...cat, score: best });
  }

  const seen = new Set();
  return scored
    .sort((a, b) => b.score - a.score || a.label.length - b.label.length)
    .filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)))
    .slice(0, max);
}

module.exports = { matchCategories, SYNONYMS };
