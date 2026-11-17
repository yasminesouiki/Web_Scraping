// Transmet automatiquement les erreurs des fonctions async au gestionnaire d'erreurs
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
