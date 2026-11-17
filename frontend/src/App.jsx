import { useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import SearchForm from "./components/SearchForm.jsx";
import Features from "./components/Features.jsx";
import ResultsList from "./components/ResultsList.jsx";
import SearchHistory from "./components/SearchHistory.jsx";
import { DownloadIcon } from "./components/Icons.jsx";
import {
  getCountries,
  searchCompanies,
  getSearches,
  getSearchResults,
  exportUrl,
} from "./api.js";

export default function App() {
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    country: "",
    city: "",
    keyword: "",
    refresh: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const [formKey, setFormKey] = useState(0);

  // Retour à l'accueil : on vide tout (secteur, pays, ville, résultats, message)
  function goHome() {
    setForm({ country: "", city: "", keyword: "", refresh: false });
    setResult(null);
    setError("");
    setFormKey((k) => k + 1); // réinitialise complètement la barre de recherche
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const refreshHistory = () =>
    getSearches()
      .then(setHistory)
      .catch(() => {});

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch((e) => setError(e.message));
    refreshHistory();
  }, []);

  async function handleSearch(params) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await searchCompanies(params));
      refreshHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Clic sur un secteur populaire : on remplit la barre et on lance la recherche
  function quickSearch(keyword) {
    if (!form.country) {
      // pas encore de pays : on remplit seulement le secteur, sans message
      setForm((f) => ({ ...f, keyword }));
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const next = { ...form, keyword };
    setForm(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    handleSearch(next);
  }

  // Suggestion "secteur" choisie : on lance la recherche sur ce secteur
  function pickSector(sector) {
    quickSearch(sector);
  }

  // Suggestion "entreprise" choisie : on l'affiche directement (déjà en base, instantané)
  function pickCompany(company) {
    setError("");
    setForm((f) => ({ ...f, keyword: company.name }));
    setResult({
      search: null,
      source: "cache",
      message: "Entreprise trouvée dans la base de données.",
      stats: { found: 1 },
      companies: [company],
    });
  }

  async function openSearch(id) {
    setError("");
    try {
      const data = await getSearchResults(id);
      setResult({
        search: data.search,
        source: "history",
        message: `Recherche du ${data.search.createdAt}`,
        stats: { found: data.companies.length },
        companies: data.companies,
      });
    } catch (e) {
      setError(e.message);
    }
  }

  const s = result?.search;
  const lastDone = history.find(
    (h) => h.status === "done" && h.resultsCount > 0,
  );
  const showHome = !result && !loading;

  return (
    <>
      <Header onHome={goHome} />
      <SearchForm
        key={formKey}
        countries={countries}
        loading={loading}
        form={form}
        setForm={setForm}
        onSearch={handleSearch}
        onPickSector={pickSector}
        onPickCompany={pickCompany}
      />

      {error && <div className="page-error">{error}</div>}

      {showHome ? (
        <Features
          countriesCount={countries.length}
          lastSearch={lastDone}
          exportHref={lastDone ? exportUrl(lastDone.id) : null}
          onQuickSearch={quickSearch}
          onOpenSearch={openSearch}
        />
      ) : (
        <main className="content" id="resultats">
          <section className="results">
            {loading && (
              <div className="loading-msg">
                <span className="spinner" /> Veuillez patienter…
              </div>
            )}

            {result && (
              <>
                <button type="button" className="back-link" onClick={goHome}>
                  ← Retour à l'accueil
                </button>
                <div className="results-header">
                  <div>
                    <h2>{result.companies.length} entreprise(s)</h2>
                    {s && (
                      <p className="results-sub">
                        « {s.keyword} » · {s.country}
                        {s.city ? ` · ${s.city}` : ""}
                      </p>
                    )}
                  </div>
                  {result.companies.length > 0 && s && (
                    <a className="export-button" href={exportUrl(s.id)}>
                      <DownloadIcon width={18} height={18} /> Exporter en CSV
                    </a>
                  )}
                </div>
                <ResultsList
                  companies={result.companies}
                  emptyMessage={result.message}
                />
              </>
            )}
          </section>

          <aside className="sidebar">
            <SearchHistory searches={history} onOpen={openSearch} />
          </aside>
        </main>
      )}
    </>
  );
}

