// Définition des routes de l'API (toutes préfixées par /api dans server.js)
const express = require('express');
const ctrl = require('../controllers/search.controller');
const { asyncHandler } = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/health', asyncHandler(ctrl.health));          // état du serveur et de la base
router.get('/countries', ctrl.countries);                  // liste des pays
router.post('/search', asyncHandler(ctrl.search));         // lancer une recherche
router.get('/searches', asyncHandler(ctrl.searches));      // historique des recherches
router.get('/searches/:id/results', asyncHandler(ctrl.searchResults));
router.get('/companies', asyncHandler(ctrl.companies));    // toutes les entreprises en base
router.get('/suggest', asyncHandler(ctrl.suggest));        // suggestions pendant la frappe
router.get('/export.csv', asyncHandler(ctrl.exportCsv));   // export CSV

module.exports = router;