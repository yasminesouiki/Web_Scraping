// Erreurs "métier" avec un code HTTP et un message clair pour l'utilisateur

class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

class CollectorError extends AppError {
  constructor(message, status = 502, code = 'COLLECTOR_ERROR') {
    super(message, status, code);
    this.name = 'CollectorError';
  }
}

module.exports = { AppError, CollectorError };
