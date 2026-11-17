// Accès à la table "companies" + gestion des doublons
const { pool } = require('../config/db');
const { normalizeText, slugify } = require('../utils/normalize');
const { SYNONYMS } = require('../collector/matcher');

const COLUMNS = `id, name, sector, country, country_code AS countryCode, city, address, phone, email,
                 website, source_url AS sourceUrl, created_at AS createdAt, updated_at AS updatedAt`;

/** Garde l'ancienne valeur si la nouvelle est vide. */
const keep = (column) => `${column} = COALESCE(NULLIF(?, ''), ${column})`;

/**
 * Enregistre une entreprise SANS créer de doublon :
 *   1) même URL source           -> mise à jour
 *   2) même nom + même téléphone -> mise à jour
 *   3) sinon                     -> nouvelle ligne
 * @returns {Promise<{id:number, created:boolean}>}
 */
async function upsertCompany(company) {
  const nameNormalized = normalizeText(company.name);
  const values = {
    name: company.name,
    sector: company.sector || '',
    country: company.country,
    countryCode: company.countryCode,
    city: company.city || '',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    website: company.website || '',
    sourceUrl: company.sourceUrl,
  };

  // 1) et 2) : recherche d'un doublon existant
  const [existing] = await pool.query(
    `SELECT id FROM companies
      WHERE source_url = ?
         OR (name_normalized = ? AND phone <> '' AND phone = ?)
      ORDER BY (source_url = ?) DESC
      LIMIT 1`,
    [values.sourceUrl, nameNormalized, values.phone, values.sourceUrl]
  );

  if (existing.length) {
    const id = existing[0].id;
    await pool.query(
      `UPDATE companies SET
         ${keep('sector')}, ${keep('city')}, ${keep('address')},
         ${keep('phone')}, ${keep('email')}, ${keep('website')}
       WHERE id = ?`,
      [values.sector, values.city, values.address, values.phone, values.email, values.website, id]
    );
    return { id, created: false };
  }

  // 3) nouvelle entreprise
  try {
    const [result] = await pool.query(
      `INSERT INTO companies
         (name, name_normalized, sector, country, country_code, city, address, phone, email, website, source_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.name, nameNormalized, values.sector, values.country, values.countryCode,
        values.city, values.address, values.phone, values.email, values.website, values.sourceUrl,
      ]
    );
    return { id: result.insertId, created: true };
  } catch (err) {
    // Deux enregistrements simultanés de la même URL : on récupère la ligne existante
    if (err.code === 'ER_DUP_ENTRY') {
      const [rows] = await pool.query('SELECT id FROM companies WHERE source_url = ?', [values.sourceUrl]);
      return { id: rows[0].id, created: false };
    }
    throw err;
  }
}

/**
 * Recherche dans la base locale (nom ou secteur), avec les synonymes du mot-clé
 * ("marketing" -> communication, publicité...). La ville est cherchée dans le champ ville
 * OU dans l'adresse web de la fiche ("...-nabeul-tunisie").
 */
async function searchLocal({ countryCode, city, keyword, limit = 300 }) {
  const kw = normalizeText(keyword);
  const terms = [...new Set([kw, ...(SYNONYMS[kw] || []).map(normalizeText)])].filter(Boolean);

  const params = [countryCode];
  const termSql = terms.map(() => '(name_normalized LIKE ? OR sector LIKE ?)').join(' OR ');
  terms.forEach((t) => params.push(`%${t}%`, `%${t}%`));
  let sql = `SELECT ${COLUMNS} FROM companies WHERE country_code = ? AND (${termSql})`;

  if (city) {
    sql += ' AND (city LIKE ? OR source_url LIKE ?)';
    params.push(`%${city}%`, `%-${slugify(city)}-%`);
  }
  sql += ' ORDER BY name LIMIT ?';
  params.push(limit);
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Liste paginée de toutes les entreprises enregistrées, avec filtres optionnels. */
async function listCompanies({ countryCode, city, q, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (countryCode) {
    where.push('country_code = ?');
    params.push(countryCode);
  }
  if (city) {
    where.push('city LIKE ?');
    params.push(`%${city}%`);
  }
  if (q) {
    where.push('(name_normalized LIKE ? OR sector LIKE ?)');
    params.push(`%${normalizeText(q)}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM companies ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM companies ${whereSql}`, params);
  return { rows, total };
}

/**
 * Suggestions pendant la frappe ("inf" -> INF Risk Management, INFAD...).
 * Les noms qui COMMENCENT par le texte passent en premier.
 */
async function suggest({ q, countryCode, limit = 8 }) {
  const n = normalizeText(q);
  if (!n) return { companies: [], sectors: [] };

  const countrySql = countryCode ? 'AND country_code = ?' : '';
  const countryParam = countryCode ? [countryCode] : [];

  const [companies] = await pool.query(
    `SELECT ${COLUMNS} FROM companies
      WHERE (name_normalized LIKE ? OR name_normalized LIKE ?) ${countrySql}
      ORDER BY (name_normalized LIKE ?) DESC, name
      LIMIT ?`,
    [`${n}%`, `% ${n}%`, ...countryParam, `${n}%`, limit]
  );

  const [sectors] = await pool.query(
    `SELECT sector, COUNT(*) AS total FROM companies
      WHERE sector <> '' AND sector LIKE ? ${countrySql}
      GROUP BY sector ORDER BY total DESC LIMIT 4`,
    [`%${q}%`, ...countryParam]
  );

  return { companies, sectors };
}

module.exports = { upsertCompany, searchLocal, listCompanies, suggest, COLUMNS };