// Point d'entrée du backend : npm start (ou npm run dev)
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const apiRoutes = require('./routes/api.routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Petit journal des requêtes dans la console
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start} ms)`));
  next();
});

app.use('/api', apiRoutes);

// Si le frontend a été compilé (npm run build), le backend le sert aussi
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`✔ API démarrée sur http://localhost:${config.port}/api`);
  console.log(`  Source collectée : ${config.collector.baseUrl}`);
});
