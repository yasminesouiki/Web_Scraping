-- =============================================================
--  Base de données du POC "GoAfrica Collector"
--  Exécuté automatiquement par : npm run db:init
-- =============================================================

CREATE DATABASE IF NOT EXISTS goafrica_poc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE goafrica_poc;

-- -------------------------------------------------------------
-- Table des entreprises collectées (une ligne = une entreprise)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name             VARCHAR(255)  NOT NULL,
  name_normalized  VARCHAR(255)  NOT NULL,          -- nom sans accents/majuscules (doublons + recherche)
  sector           VARCHAR(255)  NULL,
  country          VARCHAR(100)  NOT NULL,
  country_code     CHAR(2)       NOT NULL,
  city             VARCHAR(120)  NULL,
  address          VARCHAR(500)  NULL,
  phone            VARCHAR(120)  NULL,
  email            VARCHAR(255)  NULL,
  website          VARCHAR(500)  NULL,
  source_url       VARCHAR(500)  NOT NULL,          -- page d'où vient l'information
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_source_url (source_url),  -- 1er niveau de gestion des doublons
  KEY idx_companies_country_city (country_code, city),
  KEY idx_companies_name (name_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Historique des recherches (une ligne = une recherche lancée)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS searches (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  country_code        CHAR(2)      NOT NULL,
  country             VARCHAR(100) NOT NULL,
  city                VARCHAR(120) NOT NULL DEFAULT '',
  city_normalized     VARCHAR(120) NOT NULL DEFAULT '',
  keyword             VARCHAR(255) NOT NULL,
  keyword_normalized  VARCHAR(255) NOT NULL,
  status              ENUM('running', 'done', 'failed') NOT NULL DEFAULT 'running',
  source              ENUM('live', 'local') NULL,     -- live = collecte Internet, local = base existante
  results_count       INT UNSIGNED NOT NULL DEFAULT 0,
  message             VARCHAR(500) NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at         TIMESTAMP    NULL,
  PRIMARY KEY (id),
  KEY idx_searches_lookup (country_code, keyword_normalized, city_normalized, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Lien recherche <-> entreprises trouvées
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_results (
  search_id   INT UNSIGNED NOT NULL,
  company_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (search_id, company_id),
  CONSTRAINT fk_sr_search  FOREIGN KEY (search_id)  REFERENCES searches(id)  ON DELETE CASCADE,
  CONSTRAINT fk_sr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
