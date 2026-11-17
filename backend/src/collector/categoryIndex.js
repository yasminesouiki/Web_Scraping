// =============================================================
//  INDEX DES CATÉGORIES DU SITE (par pays)
//
//  La page /tn/annuaire (ou /gh/directory pour les pays anglophones) ne montre que les GRANDS secteurs ("Formations, éducation",
//  "Transport, logistique"...). Les vraies catégories qui contiennent les entreprises
//  ("Enseignement supérieur, université", "Transitaires"...) sont dans chaque secteur.
//
//  Cet index ouvre une fois chaque secteur et enregistre TOUTES les catégories dans
//  backend/data/categories-<pays>.json. Ensuite, n'importe quel mot-clé ("université",
//  "logistique", "économie"...) trouve sa catégorie instantanément.
// =============================================================
const fs = require('fs');
const path = require('path');
const { config } = require('../config/env');
const { fetchHtml } = require('./http');
const { parseCategories } = require('./parser');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const MAX_AGE_DAYS = 30;
const memory = new Map(); // code pays -> index

function filePath(countryCode) {
  return path.join(DATA_DIR, `categories-${countryCode}.json`);
}

function load(countryCode) {
  if (memory.has(countryCode)) return memory.get(countryCode);
  try {
    const index = JSON.parse(fs.readFileSync(filePath(countryCode), 'utf8'));
    const ageDays = (Date.now() - new Date(index.updatedAt).getTime()) / 86400000;
    if (ageDays <= MAX_AGE_DAYS) {
      memory.set(countryCode, index);
      return index;
    }
  } catch {
    // pas encore d'index pour ce pays
  }
  return null;
}

function save(index) {
  index.updatedAt = new Date().toISOString();
  memory.set(index.countryCode, index);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath(index.countryCode), JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    console.warn('[index] impossible d\'écrire le fichier :', err.message);
  }
}

function addAll(index, categories) {
  const known = new Set(index.categories.map((c) => c.slug));
  for (const cat of categories) {
    if (!known.has(cat.slug)) {
      index.categories.push(cat);
      known.add(cat.slug);
    }
  }
}

/**
 * Retourne toutes les catégories connues d'un pays.
 * Si l'index n'est pas complet, on continue à le construire pendant `budgetMs` au maximum
 * (ce qui n'a pas été fait sera repris à la prochaine recherche).
 *
 * @param {string} countryCode
 * @param {object} [opts]
 * @param {number} [opts.budgetMs]       temps maximum pour compléter l'index
 * @param {function} [opts.fetcher]      fonction de téléchargement
 * @param {function} [opts.onProgress]
 */
async function getCategoryIndex(countryCode, { budgetMs = 25000, fetcher = fetchHtml, onProgress } = {}) {
  const baseUrl = config.collector.baseUrl;
  let index = load(countryCode);

  if (!index) {
    // Pays francophones : /tn/annuaire — pays anglophones : /gh/directory
    let html;
    try {
      html = await fetcher(`${baseUrl}/${countryCode}/annuaire`);
    } catch (err) {
      if (err.code !== 'NOT_FOUND') throw err;
      html = await fetcher(`${baseUrl}/${countryCode}/directory`);
    }
    const sectors = parseCategories(html, countryCode, baseUrl);
    index = {
      countryCode,
      sectors: sectors.map((s) => s.url), // pages à ouvrir pour trouver les sous-catégories
      crawled: [],
      complete: false,
      categories: [],
    };
    addAll(index, sectors);
    save(index);
  }

  if (index.complete) return index.categories;

  const deadline = Date.now() + budgetMs;
  for (const sectorUrl of index.sectors) {
    if (index.crawled.includes(sectorUrl)) continue;
    if (Date.now() > deadline) break;
    if (onProgress) onProgress(`Index des catégories : ${sectorUrl}`);
    try {
      const html = await fetcher(sectorUrl);
      addAll(index, parseCategories(html, countryCode, baseUrl));
    } catch (err) {
      if (err.code === 'TIME_UP') break;
      // page en erreur : on la marque quand même pour ne pas bloquer l'index
    }
    index.crawled.push(sectorUrl);
  }
  index.complete = index.sectors.every((u) => index.crawled.includes(u));
  save(index);
  return index.categories;
}

/** Ajoute à l'index des catégories découvertes pendant une collecte. */
function rememberCategories(countryCode, categories) {
  const index = load(countryCode);
  if (!index || !categories.length) return;
  const before = index.categories.length;
  addAll(index, categories);
  if (index.categories.length > before) save(index);
}

function isIndexComplete(countryCode) {
  const index = load(countryCode);
  return Boolean(index && index.complete);
}

module.exports = { getCategoryIndex, rememberCategories, isIndexComplete };