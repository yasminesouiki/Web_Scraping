# GoAfrica Collector : moteur de recherche et de collecte d'entreprises africaines (POC)

Application web qui permet de rechercher des entreprises africaines par **pays**, **ville** et **secteur d'activité ou nom**.
Les données sont **collectées automatiquement** sur un annuaire en ligne, **enregistrées** dans une base MySQL sans doublons et **exportables en CSV**.

---

## 1. Fonctionnalités

- Recherche par pays, ville (facultative) et mot-clé (secteur ou nom d'entreprise)
- Collecte automatique sur le site source, avec les champs suivants : nom, secteur, pays, ville, adresse, téléphone, email, site internet, URL source
- Base de données MySQL qui conserve tous les résultats
- Gestion des doublons (même URL source, ou même nom + même téléphone)
- Cache : une recherche identique faite récemment est lue directement en base
- Export CSV, compatible Excel (séparateur `;`, accents conservés)
- Historique des recherches
- Gestion des erreurs avec des messages clairs (site injoignable, aucun résultat, base inaccessible…)
- Module de collecte **indépendant**, utilisable en ligne de commande sans l'interface

---

## 2. Architecture

```
Interface React  ──►  API Node/Express  ──►  MySQL
   (frontend)            (backend)            (companies, searches, search_results)
                             │
                             ▼
                    Module de collecte  ──►  Site source
                    (backend/src/collector)
```

**Déroulement d'une recherche**

1. L'utilisateur saisit un pays, une ville et un mot-clé, puis clique sur « Rechercher ».
2. L'API vérifie si la même recherche a été faite il y a moins de `CACHE_DAYS` jours. Si oui, les résultats sont lus en base.
3. Sinon, le collecteur :
   - associe le mot-clé à un ou plusieurs secteurs du site (ex. « info » → « Informatique ») ;
   - parcourt les pages de liste (`?p=1`, `?p=2`…) ;
   - garde les entreprises de la ville demandée (la ville figure dans l'URL de chaque fiche) ;
   - ouvre chaque fiche et en extrait les informations.
4. Les entreprises sont enregistrées en base sans doublons, puis reliées à la recherche.
5. Si aucun secteur ne correspond (par exemple pour un nom d'entreprise), ou si le site est injoignable, la recherche se fait dans la base locale.

### Arborescence

```
goafrica-collector/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env.example              ← configuration (à copier en .env)
│   ├── database/schema.sql       ← structure de la base
│   ├── tests/extract.test.js     ← tests unitaires (npm test)
│   └── src/
│       ├── server.js             ← point d'entrée de l'API
│       ├── config/               ← env.js (configuration), db.js (connexion MySQL)
│       ├── routes/               ← api.routes.js (liste des routes)
│       ├── controllers/          ← search.controller.js (requêtes HTTP → réponses)
│       ├── services/             ← search.service.js (logique : cache, collecte, enregistrement)
│       ├── models/               ← company.model.js, search.model.js (requêtes SQL)
│       ├── middlewares/          ← gestion des erreurs
│       ├── utils/                ← normalisation du texte, CSV, erreurs
│       ├── scripts/initDb.js     ← création de la base (npm run db:init)
│       └── collector/            ← MODULE DE COLLECTE (indépendant)
│           ├── index.js          ← fonction collect()
│           ├── cli.js            ← lancement en ligne de commande
│           ├── http.js           ← téléchargement (pause, délai, nouvelles tentatives, robots.txt)
│           ├── parser.js         ← lecture du HTML (sélecteurs regroupés ici)
│           ├── extract.js        ← extraction téléphone / email / ville / JSON-LD
│           ├── matcher.js        ← mot-clé → secteurs du site
│           ├── robots.js         ← lecture du robots.txt
│           └── countries.js      ← pays et codes (sn, ci, ma…)
└── frontend/
    ├── package.json
    ├── vite.config.js            ← redirige /api vers le backend
    ├── index.html
    └── src/
        ├── main.jsx, App.jsx, api.js, styles.css
        └── components/           ← Header, SearchForm (barre de recherche), Features (accueil), CompanyCard (carte entreprise),
                                    ResultsList, StatusBanner, SearchHistory, Icons
```

### Base de données

| Table | Rôle |
|---|---|
| `companies` | Une ligne par entreprise collectée. `source_url` est **unique**. |
| `searches` | Une ligne par recherche lancée (pays, ville, mot-clé, statut, nombre de résultats). |
| `search_results` | Lien entre une recherche et les entreprises trouvées. |

---

## 3. Choix techniques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Interface | **React + Vite** | Composants simples, démarrage rapide, rechargement instantané |
| API | **Node.js + Express** | Léger, même langage (JavaScript) que le frontend |
| Collecte | **fetch natif + Cheerio** | Les pages du site sont du HTML classique : pas besoin d'un navigateur complet. Cheerio permet de lire le HTML comme avec jQuery. |
| Base de données | **MySQL** | Base relationnelle répandue, contrainte d'unicité utile pour les doublons |
| Pourquoi pas d'agent IA ? | — | Les données sont déjà structurées : un collecteur classique est plus rapide, gratuit, reproductible et n'invente pas de données. L'IA reste une amélioration possible (voir §8). |

---

## 4. Installation

### Prérequis

- Node.js 22
- MySQL : WAMP

### Étapes


# 1. Backend
cd backend
npm install
cp .env.example .env        # sous Windows : copy .env.example .env
# → ouvrir .env et renseigner DB_USER / DB_PASSWORD
npm run db:init             # crée la base info_collect et les tables
npm run dev

# 2. Frontend
cd frontend
npm install
npm run dev


On fait la vérification : http://localhost:4000/api/health * Affichage `{"status":"ok","database":"connected"}`.

---

## 5. Utilisation

### Interface web

1. Ouvrir http://localhost:5173
2. Choisir un pays, saisir une ville (facultatif) et un mot-clé (ex. `informatique`, `communication`, `banque`)
3. Cliquer sur **Rechercher**. La 1re fois, la collecte prend de quelques secondes à une minute.
4. Cliquer sur **Exporter en CSV** pour télécharger les résultats.
5. Relancer la même recherche : les résultats viennent instantanément de la base. Cocher « Forcer une nouvelle collecte » pour recollecter.


### API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | État du serveur et de la base |
| GET | `/api/countries` | Liste des pays |
| POST | `/api/search` | Lance une recherche. Corps : `{ "country": "sn", "city": "Dakar", "keyword": "informatique", "refresh": false }` |
| GET | `/api/searches` | Historique des recherches |
| GET | `/api/searches/:id/results` | Résultats d'une recherche |
| GET | `/api/companies?country=sn&city=dakar&q=info&page=1` | Toutes les entreprises en base |
| GET | `/api/export.csv?searchId=12` | Export CSV d'une recherche (ou de toute la base avec `country`, `city`, `q`) |


## 6. Gestion des doublons et des erreurs

**Doublons**
- Niveau 1 : `source_url` est unique en base. La même fiche n'est jamais enregistrée deux fois.
- Niveau 2 : même nom normalisé (sans accents ni majuscules) + même téléphone → l'entreprise existante est mise à jour au lieu d'être dupliquée.
- Lors d'une mise à jour, une information déjà connue n'est jamais effacée par une valeur vide.

**Erreurs gérées**

| Situation | Comportement |
|---|---|
| Site source injoignable / trop lent | 2 nouvelles tentatives, puis message clair ; recherche dans la base locale si possible |
| Page interdite par robots.txt | Collecte refusée, message explicite |
| Mot-clé sans secteur correspondant | Recherche par nom dans la base locale |
| Aucune entreprise dans la ville | Message indiquant le nombre de pages parcourues |
| Une fiche illisible | Les autres fiches continuent ; le nom vu dans la liste est conservé |
| Structure du site modifiée | Erreur `PARSE_ERROR` ; il suffit d'adapter `collector/parser.js` |
| MySQL arrêté / base absente | Message « base de données non accessible » |
| Formulaire incomplet | Validation côté interface et côté API |

---

## 7. Collecte responsable et légalité

- Le collecteur lit et **respecte le fichier robots.txt** du site (`RESPECT_ROBOTS_TXT=true`).
- **Pause de 1,5 s** entre deux requêtes et nombre de pages limité, pour ne pas surcharger le site.
- Seules des informations **professionnelles publiques** sont collectées, et **l'URL source** est conservée pour chaque entreprise.
- Avant tout usage commercial, il faut vérifier les **conditions d'utilisation** du site source et la réglementation sur les données (ex. loi marocaine 09-08, RGPD).

---

## 8. Limites connues

- L'email est rarement affiché publiquement sur le site source : le champ est souvent vide.
- Le filtre par ville s'appuie sur l'URL et l'adresse des fiches, et peut donc manquer quelques entreprises.
- La recherche par nom porte sur les données déjà collectées. Pour chercher un nom directement sur le site, renseigner `SEARCH_URL_TEMPLATE` dans `.env` après avoir identifié l'URL de recherche du site (F12 → onglet Réseau).


## 9. Dépannage

| Problème | Solution |
|---|---|
| `ECONNREFUSED` / base inaccessible | Démarrer MySQL, vérifier `.env`, relancer `npm run db:init` |
| 0 résultat alors que le site en affiche | Le HTML du site a peut-être changé : ouvrir une fiche, faire F12, adapter les sélecteurs dans `collector/parser.js` |
| `Page interdite aux robots` | Le site interdit cette page : ne pas la collecter |
| Collecte trop longue | Réduire `MAX_COMPANIES` ou `MAX_LISTING_PAGES` dans `.env` |
| L'interface affiche « Impossible de contacter le serveur » | Vérifier que le backend tourne sur le port 4000 |
