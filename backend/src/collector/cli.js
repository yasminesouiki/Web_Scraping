#!/usr/bin/env node
// Lancer le collecteur SANS l'interface ni l'API (preuve qu'il est indépendant).
//
// Exemples :
//   npm run collect -- --country sn --keyword informatique
//   npm run collect -- --country sn --keyword communication --city dakar --max 5
//   npm run collect -- --country ci --keyword banque --save          (enregistre en base)
//   npm run collect -- --country ma --keyword hotel --out resultats.json
const fs = require('fs');
const { collect } = require('./index');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
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
  if (!args.country || !args.keyword) {
    console.log('Utilisation : npm run collect -- --country sn --keyword informatique [--city dakar] [--pages 3] [--max 10] [--save] [--out fichier.json]');
    process.exit(1);
  }

  const result = await collect({
    country: args.country,
    keyword: args.keyword,
    city: typeof args.city === 'string' ? args.city : '',
    maxPages: args.pages ? Number(args.pages) : undefined,
    maxCompanies: args.max ? Number(args.max) : undefined,
    onProgress: (msg) => console.log('  •', msg),
  });

  console.log('\n' + result.message);
  if (result.errors.length) console.log(`${result.errors.length} fiche(s) en erreur :`, result.errors);
  console.table(result.companies.map(({ name, city, phone, email, website }) => ({ name, city, phone, email, website })));

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(result.companies, null, 2), 'utf8');
    console.log(`Résultats écrits dans ${args.out}`);
  }

  if (args.save) {
    const { saveCollectedCompanies } = require('../services/search.service');
    const stats = await saveCollectedCompanies(result.companies);
    console.log(`Enregistré en base : ${stats.created} nouvelle(s), ${stats.duplicates} déjà connue(s).`);
    await require('../config/db').pool.end();
  }
}

main().catch((err) => {
  console.error('✖ Erreur :', err.message);
  process.exit(1);
});
