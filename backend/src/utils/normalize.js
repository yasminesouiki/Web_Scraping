// Fonctions de nettoyage et de normalisation du texte

/** Supprime les espaces multiples et les retours à la ligne. */
function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Minuscules, sans accents, sans ponctuation : "Côte d'Ivoire" -> "cote d ivoire" */
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Version "URL" d'un texte : "Saint Louis" -> "saint-louis" */
function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

/** "saint-louis" -> "Saint-Louis", "DAKAR" -> "Dakar" */
function titleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (m, sep, letter) => sep + letter.toUpperCase());
}

/** Garde uniquement les caractères utiles d'un numéro de téléphone. */
function normalizePhone(value) {
  return cleanText(String(value ?? '').replace(/[^\d+()\s.-]/g, ' '))
    .replace(/\s*\.\s*/g, ' ')
    .trim();
}

/** Supprime les doublons d'une liste en gardant l'ordre. */
function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

module.exports = { cleanText, normalizeText, slugify, titleCase, normalizePhone, unique };
