#!/usr/bin/env node
// Construit l'index COMPLET des catégories d'un ou plusieurs pays (à faire une fois).
//   npm run index -- --country tn
//   npm run index -- --country tn,ma,sn
const { getCategoryIndex, isIndexComplete } = require('../collector/categoryIndex');
const { getCountry } = require('../collector/countries');

async function main() {
  const i = process.argv.indexOf('--country');
  const arg = i > -1 ? process.argv[i + 1] : 'tn';
  const list = arg === 'all'
    ? require('../collector/countries').COUNTRIES
    : arg.split(',').map((c) => getCountry(c.trim())).filter(Boolean);
  if (!list.length) {
    console.log('Pays inconnu. Exemple : npm run index -- --country tn');
    process.exit(1);
  }
  for (const country of list) {
    const started = Date.now();
    const categories = await getCategoryIndex(country.code, {
      budgetMs: 10 * 60 * 1000,
      onProgress: (msg) => console.log('  •', msg),
    });
    console.log(
      `✔ ${country.name} : ${categories.length} catégories ${isIndexComplete(country.code) ? '(index complet)' : '(incomplet)'} en ${Math.round((Date.now() - started) / 1000)} s`
    );
  }
}

main().catch((err) => {
  console.error('✖ Erreur :', err.message);
  process.exit(1);
});