// Association d'un mot-clé libre ("info", "marketing"...) aux secteurs du site
const { normalizeText } = require('../utils/normalize');

// Quelques équivalences utiles (à compléter librement)
const SYNONYMS = {
  info: ['informatique', 'computer', 'it services'],
  informatique: ['informatique', 'computer', 'software', 'it services'],
  it: ['informatique', 'computer'],
  tech: ['informatique', 'computer', 'technology'],
  web: ['internet', 'informatique', 'web'],
  digital: ['internet', 'communication', 'digital'],
  marketing: ['marketing', 'communication', 'publicite', 'advertising'],
  communication: ['communication', 'publicite', 'advertising', 'media'],
  pub: ['publicite', 'advertising'],
  commercial: ['commerce', 'distribution', 'trade'],
  commerce: ['commerce', 'trade', 'import'],
  resto: ['restaurant'],
  restauration: ['restaurant', 'catering'],
  restaurant: ['restaurant', 'catering'],
  hotel: ['hotel', 'hotellerie', 'accommodation'],
  banque: ['banque', 'banques', 'bank'],
  assurance: ['assurance', 'assurances', 'insurance'],
  avocat: ['avocat', 'avocats', 'lawyer', 'law firm', 'legal'],
  comptable: ['comptable', 'expertise comptable', 'accounting', 'audit'],
  transport: ['transport', 'transports', 'logistique', 'logistics'],
  logistique: ['logistique', 'transport', 'transit', 'transitaire', 'fret', 'logistics', 'freight'],
  btp: ['batiment', 'construction', 'btp', 'building'],
  construction: ['construction', 'batiment', 'building'],
  sante: ['sante', 'clinique', 'medecin', 'hopital', 'health', 'hospital', 'clinic', 'doctor'],
  medecin: ['medecin', 'clinique', 'sante', 'doctor', 'clinic'],
  docteur: ['medecin', 'clinique', 'sante', 'doctor', 'clinic'],
  dr: ['medecin', 'doctor'],
  dentiste: ['dentiste', 'dentaire', 'dentist', 'dental'],
  clinique: ['clinique', 'polyclinique', 'clinic', 'hopital', 'hospital'],
  hopital: ['hopital', 'clinique', 'hospital'],
  pharmacie: ['pharmacie', 'pharmacies', 'pharmacy'],
  formation: ['formation', 'ecole', 'training', 'education'],
  ecole: ['ecole', 'enseignement', 'formation', 'school', 'education', 'formations'],
  universite: ['universite', 'enseignement superieur', 'ecole superieure', 'institut', 'university', 'higher education', 'enseignement', 'formation', 'education'],
  fac: ['universite', 'enseignement superieur', 'university'],
  economie: ['economie', 'economique', 'conseil', 'etudes', 'finance', 'consulting', 'economic'],
  finance: ['finance', 'banque', 'microfinance', 'investissement', 'bank', 'investment'],
  immobilier: ['immobilier', 'agence immobiliere', 'real estate', 'property'],
  agriculture: ['agriculture', 'agricole', 'agro', 'farming', 'farm'],
  energie: ['energie', 'electricite', 'solaire', 'energy', 'electricity', 'solar'],
  industrie: ['industrie', 'industries', 'industry', 'manufacturing'],
  tourisme: ['tourisme', 'voyage', 'tourism', 'travel'],
  voiture: ['automobile', 'voiture', 'vehicule', 'car', 'vehicle'],
  telecom: ['telecommunication', 'telephonie', 'telecom'],
  import: ['import', 'export', 'import export'],
  export: ['export', 'import', 'import export'],
};

/** "universités" -> ["universites", "universite"] : on accepte singulier et pluriel. */
function variants(term) {
  const t = normalizeText(term);
  const out = new Set([t]);
  if (/[sx]$/.test(t) && t.length > 3) out.add(t.slice(0, -1));
  return [...out];
}

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
  const base = variants(kw);
  const synonyms = base.flatMap((b) => SYNONYMS[b] || []);
  const terms = [...new Set([...base, ...synonyms.flatMap(variants)])];

  const scored = [];
  for (const cat of categories) {
    let best = 0;
    let direct = false; // vrai si c'est le mot-clé lui-même (pas un synonyme) qui correspond
    for (const term of terms) {
      const isBase = base.includes(term);
      // le mot-clé exact compte un peu plus que ses synonymes
      const s = scoreLabel(cat.label, cat.slug, term) - (isBase ? 0 : 5);
      if (s > best) best = s;
      if (isBase && s > 0) direct = true;
    }
    if (best > 0) scored.push({ ...cat, score: best, direct });
  }

  const seen = new Set();
  return scored
    .sort((a, b) => b.score - a.score || a.label.length - b.label.length)
    .filter((c) => (seen.has(c.slug) ? false : seen.add(c.slug)))
    .slice(0, max);
}

module.exports = { matchCategories, SYNONYMS, variants };