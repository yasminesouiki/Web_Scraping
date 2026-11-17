// Chargement de la configuration depuis le fichier .env
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const config = {
  port: toInt(process.env.PORT, 4000),

  db: {
    host: process.env.DB_HOST || "localhost",
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "goafrica_poc",
  },

  collector: {
    baseUrl: (
      process.env.SOURCE_BASE_URL || "https://www.goafricaonline.com"
    ).replace(/\/+$/, ""),
    requestDelayMs: toInt(process.env.REQUEST_DELAY_MS, 500),
    requestTimeoutMs: toInt(process.env.REQUEST_TIMEOUT_MS, 8000),
    maxListingPages: toInt(process.env.MAX_LISTING_PAGES, 3),
    maxCompanies: toInt(process.env.MAX_COMPANIES, 20),
    maxCategories: toInt(process.env.MAX_CATEGORIES, 6),
    maxSubcategories: toInt(process.env.MAX_SUBCATEGORIES, 12),
    // Durée maximale d'une collecte (secondes) : au-delà, on renvoie ce qui a été trouvé
    maxCollectSeconds: toInt(process.env.MAX_COLLECT_SECONDS, 10),
    // 1re recherche d'un pays : temps maximum pour construire l'index des catégories
    indexBuildSeconds: toInt(process.env.INDEX_BUILD_SECONDS, 25),
    // true = ouvrir chaque fiche pour chercher email et site web (plus lent)
    fetchDetails:
      (process.env.FETCH_DETAILS || "false").toLowerCase() === "true",
    respectRobotsTxt:
      (process.env.RESPECT_ROBOTS_TXT || "true").toLowerCase() !== "false",
    userAgent:
      process.env.USER_AGENT ||
      "Mozilla/5.0 (compatible; GoAfricaCollectorPOC/1.0; projet de stage)",
    searchUrlTemplate: process.env.SEARCH_URL_TEMPLATE || "",
  },

  cacheDays: toInt(process.env.CACHE_DAYS, 7),
};

module.exports = { config };
