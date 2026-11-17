// Crée la base de données et les tables à partir de database/schema.sql
// Utilisation : npm run db:init
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('../config/env');

async function main() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  let sql = fs.readFileSync(schemaPath, 'utf8');

  // Si un autre nom de base est défini dans .env, on l'utilise
  if (config.db.database !== 'goafrica_poc') {
    sql = sql.replace(/goafrica_poc/g, config.db.database);
  }

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  await connection.query(sql);
  await connection.end();
  console.log(`✔ Base "${config.db.database}" et tables créées (ou déjà existantes).`);
}

main().catch((err) => {
  console.error('✖ Impossible d\'initialiser la base de données :', err.message);
  console.error('  Vérifiez que MySQL est démarré et que DB_USER / DB_PASSWORD sont corrects dans backend/.env');
  process.exit(1);
});
