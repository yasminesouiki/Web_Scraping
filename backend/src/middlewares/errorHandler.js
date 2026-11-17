// Gestion centralisée des erreurs : toujours une réponse JSON claire { error, code }
const { AppError } = require('../utils/errors');

function notFound(req, res) {
  res.status(404).json({ error: `Route inconnue : ${req.method} ${req.originalUrl}`, code: 'ROUTE_NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  // Erreurs MySQL fréquentes
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(err.code)) {
    console.error('[DB]', err.code, err.message);
    return res.status(503).json({
      error: "La base de données n'est pas accessible. Vérifiez que MySQL est lancé et que « npm run db:init » a été exécuté.",
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Requête invalide (JSON mal formé).', code: 'BAD_REQUEST' });
  }

  console.error('[ERREUR]', err);
  res.status(500).json({ error: 'Erreur interne du serveur.', code: 'INTERNAL_ERROR' });
}

module.exports = { notFound, errorHandler };
