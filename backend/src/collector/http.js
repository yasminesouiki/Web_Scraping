// Téléchargement des pages : pause entre requêtes, délai max, nouvelles tentatives,
// respect du robots.txt et messages d'erreur clairs.
const { config } = require('../config/env');
const { CollectorError } = require('../utils/errors');
const { parseRobots, isPathAllowed } = require('./robots');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;
const robotsCache = new Map(); // origine -> règles

async function politeDelay() {
  const wait = lastRequestAt + config.collector.requestDelayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function headers() {
  return {
    'User-Agent': config.collector.userAgent,
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6',
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.collector.requestTimeoutMs);
  try {
    return await fetch(url, { headers: headers(), signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function getRobotsRules(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = [];
  try {
    await politeDelay();
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // robots.txt inaccessible : on considère qu'il n'y a pas de restriction
  }
  robotsCache.set(origin, rules);
  return rules;
}

async function assertAllowedByRobots(url) {
  if (!config.collector.respectRobotsTxt) return;
  const u = new URL(url);
  const rules = await getRobotsRules(u.origin);
  if (!isPathAllowed(u.pathname + u.search, rules)) {
    throw new CollectorError(
      `Page interdite aux robots par le site (robots.txt) : ${u.pathname}${u.search}`,
      403,
      'BLOCKED_BY_ROBOTS'
    );
  }
}

/**
 * Télécharge une page HTML.
 * - 404 -> erreur NOT_FOUND (pas de nouvelle tentative)
 * - 429 / 5xx / réseau / délai dépassé -> jusqu'à `retries` nouvelles tentatives
 */
async function fetchHtml(url, { retries = 2 } = {}) {
  await assertAllowedByRobots(url);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeDelay();
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) return await res.text();

      if (res.status === 404) {
        throw new CollectorError(`Page introuvable sur le site source : ${url}`, 404, 'NOT_FOUND');
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new CollectorError(
          `Le site source est indisponible ou limite les requêtes (HTTP ${res.status}).`,
          502,
          'SOURCE_UNAVAILABLE'
        );
      } else {
        throw new CollectorError(
          `Le site source a refusé la requête (HTTP ${res.status}).`,
          502,
          'SOURCE_REFUSED'
        );
      }
    } catch (err) {
      if (err instanceof CollectorError) {
        if (err.code !== 'SOURCE_UNAVAILABLE') throw err;
        lastError = err;
      } else if (err.name === 'AbortError') {
        lastError = new CollectorError('Le site source met trop de temps à répondre.', 504, 'TIMEOUT');
      } else {
        lastError = new CollectorError(
          `Impossible de joindre le site source (${err.cause?.code || err.message}).`,
          502,
          'SOURCE_UNREACHABLE'
        );
      }
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt); // 1 s, puis 2 s
  }
  throw lastError;
}

module.exports = { fetchHtml, sleep };
