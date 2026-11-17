// Accès aux tables "searches" et "search_results"
const { pool } = require('../config/db');
const { COLUMNS } = require('./company.model');

const SEARCH_COLUMNS = `id, country_code AS countryCode, country, city, keyword, status, source,
                        results_count AS resultsCount, message, created_at AS createdAt, finished_at AS finishedAt`;

/** Dernière recherche identique terminée depuis moins de `days` jours. */
async function findRecentSearch({ countryCode, keywordNormalized, cityNormalized, days }) {
  const [rows] = await pool.query(
    `SELECT ${SEARCH_COLUMNS} FROM searches
      WHERE country_code = ? AND keyword_normalized = ? AND city_normalized = ?
        AND status = 'done' AND results_count > 0
        AND created_at >= (NOW() - INTERVAL ? DAY)
      ORDER BY id DESC LIMIT 1`,
    [countryCode, keywordNormalized, cityNormalized, days]
  );
  return rows[0] || null;
}

async function createSearch({ countryCode, country, city, cityNormalized, keyword, keywordNormalized }) {
  const [result] = await pool.query(
    `INSERT INTO searches (country_code, country, city, city_normalized, keyword, keyword_normalized, status)
     VALUES (?, ?, ?, ?, ?, ?, 'running')`,
    [countryCode, country, city, cityNormalized, keyword, keywordNormalized]
  );
  return result.insertId;
}

async function finishSearch(id, { status, source = null, resultsCount = 0, message = null }) {
  await pool.query(
    `UPDATE searches SET status = ?, source = ?, results_count = ?, message = ?, finished_at = NOW() WHERE id = ?`,
    [status, source, resultsCount, message ? String(message).slice(0, 500) : null, id]
  );
}

async function linkResults(searchId, companyIds) {
  if (!companyIds.length) return;
  const rows = [...new Set(companyIds)].map((companyId) => [searchId, companyId]);
  await pool.query('INSERT IGNORE INTO search_results (search_id, company_id) VALUES ?', [rows]);
}

async function getSearchById(id) {
  const [rows] = await pool.query(`SELECT ${SEARCH_COLUMNS} FROM searches WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function getSearchResults(searchId) {
  const prefixed = COLUMNS.replace(/(^|,\s*)(\w+)/g, '$1c.$2');
  const [rows] = await pool.query(
    `SELECT ${prefixed}
       FROM search_results sr
       JOIN companies c ON c.id = sr.company_id
      WHERE sr.search_id = ?
      ORDER BY c.name`,
    [searchId]
  );
  return rows;
}

async function listSearches(limit = 20) {
  const [rows] = await pool.query(`SELECT ${SEARCH_COLUMNS} FROM searches ORDER BY id DESC LIMIT ?`, [limit]);
  return rows;
}

module.exports = {
  findRecentSearch,
  createSearch,
  finishSearch,
  linkResults,
  getSearchById,
  getSearchResults,
  listSearches,
};
