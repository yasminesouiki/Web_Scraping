// Contrôleurs : reçoivent la requête HTTP, appellent la logique, renvoient la réponse
const { runSearch } = require('../services/search.service');
const searchModel = require('../models/search.model');
const companyModel = require('../models/company.model');
const { COUNTRIES, getCountry } = require('../collector/countries');
const { pingDatabase } = require('../config/db');
const { toCsv } = require('../utils/csv');
const { AppError } = require('../utils/errors');

const CSV_COLUMNS = [
  { key: 'name', label: 'Nom' },
  { key: 'sector', label: "Secteur d'activité" },
  { key: 'country', label: 'Pays' },
  { key: 'city', label: 'Ville' },
  { key: 'address', label: 'Adresse' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Site internet' },
  { key: 'sourceUrl', label: 'URL source' },
];

async function health(req, res) {
  res.json({ status: 'ok', database: (await pingDatabase()) ? 'connected' : 'unreachable' });
}

function countries(req, res) {
  res.json(COUNTRIES);
}

async function search(req, res) {
  const { country, city, keyword, refresh } = req.body || {};
  const result = await runSearch({ country, city, keyword, refresh: Boolean(refresh) });
  res.json(result);
}

async function searches(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  res.json(await searchModel.listSearches(limit));
}

async function searchResults(req, res) {
  const id = parseInt(req.params.id, 10);
  const s = Number.isFinite(id) ? await searchModel.getSearchById(id) : null;
  if (!s) throw new AppError('Recherche introuvable.', 404, 'NOT_FOUND');
  res.json({ search: s, companies: await searchModel.getSearchResults(id) });
}

async function companies(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const country = req.query.country ? getCountry(req.query.country) : null;
  const { rows, total } = await companyModel.listCompanies({
    countryCode: country?.code,
    city: req.query.city,
    q: req.query.q,
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ total, page, limit, companies: rows });
}

/** Suggestions pendant la frappe : GET /api/suggest?q=inf&country=tn */
async function suggest(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ companies: [], sectors: [] });
  const country = req.query.country ? getCountry(req.query.country) : null;
  res.json(await companyModel.suggest({ q: q.slice(0, 60), countryCode: country?.code }));
}

/** Export CSV : d'une recherche (?searchId=12) ou de toute la base (avec filtres). */
async function exportCsv(req, res) {
  let rows;
  let filename = 'entreprises';
  if (req.query.searchId) {
    const id = parseInt(req.query.searchId, 10);
    rows = await searchModel.getSearchResults(id);
    filename = `recherche-${id}`;
  } else {
    const country = req.query.country ? getCountry(req.query.country) : null;
    ({ rows } = await companyModel.listCompanies({
      countryCode: country?.code,
      city: req.query.city,
      q: req.query.q,
      limit: 10000,
    }));
  }
  if (!rows.length) throw new AppError('Aucune donnée à exporter.', 404, 'EMPTY_EXPORT');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(toCsv(rows, CSV_COLUMNS));
}

module.exports = { health, countries, search, searches, searchResults, companies, suggest, exportCsv };