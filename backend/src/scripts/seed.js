#!/usr/bin/env node
// =============================================================
//  PRÉ-COLLECTE : remplit la base À L'AVANCE pour que les recherches
//  du site s'affichent instantanément (< 1 seconde).
//
//  Exemples :
//    npm run seed -- --country tn
//    npm run seed -- --country tn --keywords informatique,banque,hotel
//    npm run seed -- --country tn,ma,sn --details      (avec email + site web, plus lent)
//
//  À lancer une fois avant la démo (ou chaque nuit pour garder les données à jour).
// =============================================================
const { collect } = require('../collector');
const { saveCollectedCompanies } = require('../services/search.service');
const { getCountry } = require('../collector/countries');
const { config } = require('../config/env');
const { pool } = require('../config/db');
const { getCategoryIndex } = require('../collector/categoryIndex');

const DEFAULT_KEYWORDS = [
  'informatique', 'communication', 'marketing', 'banque', 'assurance', 'comptable',
  'avocat', 'transport', 'logistique', 'hotel', 'restaurant', 'tourisme', 'immobilier',
  'btp', 'industrie', 'commerce', 'sante', 'formation', 'universite', 'agriculture',
  'energie', 'economie',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const name = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[name] = true;
    else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const countries = String(args.country || 'tn').split(',').map((c) => getCountry(c.trim())).filter(Boolean);
  const keywords = args.keywords ? String(args.keywords).split(',').map((k) => k.trim()) : DEFAULT_KEYWORDS;
  if (args.details) config.collector.fetchDetails = true;

  if (!countries.length) {
    console.log('Pays inconnu. Exemple : npm run seed -- --country tn');
    process.exit(1);
  }

  const started = Date.now();
  let total = 0;
  for (const country of countries) {
    // index complet des catégories d'abord (une seule fois, gardé sur disque)
    const cats = await getCategoryIndex(country.code, { budgetMs: 10 * 60 * 1000 });
    console.log(`Index ${country.name} : ${cats.length} catégories.`);
    for (const keyword of keywords) {
      process.stdout.write(`▶ ${country.name} · ${keyword} ... `);
      try {
        const result = await collect({
          country: country.code,
          keyword,
          maxPages: Number(args.pages) || 10,
          maxCompanies: Number(args.max) || 300,
          maxSeconds: Number(args.seconds) || 180,
          maxSubcategories: 20,
        });
        const stats = await saveCollectedCompanies(result.companies);
        total += stats.created;
        console.log(`${result.companies.length} trouvée(s), ${stats.created} nouvelle(s)`);
      } catch (err) {
        console.log(`erreur : ${err.message}`);
      }
    }
  }

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM companies');
  console.log(`\n✔ Terminé en ${Math.round((Date.now() - started) / 1000)} s : ${total} nouvelle(s) entreprise(s). Total en base : ${n}.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('✖ Erreur :', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});