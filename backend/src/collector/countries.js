// Pays disponibles sur Go Africa Online et leur code dans l'URL
// (ex. Sénégal -> https://www.goafricaonline.com/sn/annuaire)
// nameEn : le site existe aussi en anglais ("Tunis - 1002 - Tunisia")
const { normalizeText } = require('../utils/normalize');

const COUNTRIES = [
  { code: 'za', name: 'Afrique du Sud', nameEn: 'South Africa' },
  { code: 'dz', name: 'Algérie', nameEn: 'Algeria' },
  { code: 'ao', name: 'Angola', nameEn: 'Angola' },
  { code: 'bj', name: 'Bénin', nameEn: 'Benin' },
  { code: 'bw', name: 'Botswana', nameEn: 'Botswana' },
  { code: 'bf', name: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { code: 'cm', name: 'Cameroun', nameEn: 'Cameroon' },
  { code: 'cg', name: 'Congo-Brazzaville', nameEn: 'Congo' },
  { code: 'cd', name: 'Congo-Kinshasa', nameEn: 'DR Congo' },
  { code: 'ci', name: "Côte d'Ivoire", nameEn: 'Ivory Coast' },
  { code: 'dj', name: 'Djibouti', nameEn: 'Djibouti' },
  { code: 'eg', name: 'Égypte', nameEn: 'Egypt' },
  { code: 'et', name: 'Éthiopie', nameEn: 'Ethiopia' },
  { code: 'ga', name: 'Gabon', nameEn: 'Gabon' },
  { code: 'gh', name: 'Ghana', nameEn: 'Ghana' },
  { code: 'gn', name: 'Guinée', nameEn: 'Guinea' },
  { code: 'ke', name: 'Kenya', nameEn: 'Kenya' },
  { code: 'lr', name: 'Liberia', nameEn: 'Liberia' },
  { code: 'mg', name: 'Madagascar', nameEn: 'Madagascar' },
  { code: 'mw', name: 'Malawi', nameEn: 'Malawi' },
  { code: 'ml', name: 'Mali', nameEn: 'Mali' },
  { code: 'ma', name: 'Maroc', nameEn: 'Morocco' },
  { code: 'mu', name: 'Maurice', nameEn: 'Mauritius' },
  { code: 'mz', name: 'Mozambique', nameEn: 'Mozambique' },
  { code: 'na', name: 'Namibie', nameEn: 'Namibia' },
  { code: 'ne', name: 'Niger', nameEn: 'Niger' },
  { code: 'ng', name: 'Nigeria', nameEn: 'Nigeria' },
  { code: 'ug', name: 'Ouganda', nameEn: 'Uganda' },
  { code: 'cf', name: 'République centrafricaine', nameEn: 'Central African Republic' },
  { code: 'sn', name: 'Sénégal', nameEn: 'Senegal' },
  { code: 'so', name: 'Somalie', nameEn: 'Somalia' },
  { code: 'tz', name: 'Tanzanie', nameEn: 'Tanzania' },
  { code: 'tg', name: 'Togo', nameEn: 'Togo' },
  { code: 'tn', name: 'Tunisie', nameEn: 'Tunisia' },
];

/** Accepte un code ("sn") ou un nom ("Sénégal", "senegal"). */
function getCountry(value) {
  const v = normalizeText(value);
  if (!v) return null;
  return (
    COUNTRIES.find((c) => c.code === v) ||
    COUNTRIES.find((c) => normalizeText(c.name) === v || normalizeText(c.nameEn) === v) ||
    null
  );
}

module.exports = { COUNTRIES, getCountry };
