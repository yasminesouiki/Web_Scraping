import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./Icons.jsx";
import Suggestions from "./Suggestions.jsx";
import { getSuggestions } from "../api.js";

// Barre de recherche : "Qui, quoi ?" (avec suggestions) | "Où ?" (pays + ville) | bouton Rechercher
// Les valeurs sont gérées par App (form / setForm) pour permettre les recherches rapides.
export default function SearchForm({
  countries,
  loading,
  form,
  setForm,
  onSearch,
  onPickSector,
  onPickCompany,
}) {
  const [formError, setFormError] = useState("");
  const [sugg, setSugg] = useState({ sectors: [], companies: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const lastQuery = useRef("");

  const update = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  // Suggestions pendant la frappe (petite attente de 200 ms pour ne pas appeler l'API à chaque lettre)
  useEffect(() => {
    const q = form.keyword.trim();
    if (q.length < 2) {
      setSugg({ sectors: [], companies: [] });
      return undefined;
    }
    const timer = setTimeout(() => {
      lastQuery.current = q;
      getSuggestions(q, form.country)
        .then((data) => {
          if (lastQuery.current === q) {
            setSugg(data);
            setActive(-1);
          }
        })
        .catch(() => setSugg({ sectors: [], companies: [] }));
    }, 200);
    return () => clearTimeout(timer);
  }, [form.keyword, form.country]);

  const items = [
    ...sugg.sectors.map((s) => ({ type: "sector", value: s })),
    ...sugg.companies.map((c) => ({ type: "company", value: c })),
  ];

  function pick(item) {
    setOpen(false);
    if (item.type === "sector") onPickSector(item.value.sector);
    else onPickCompany(item.value);
  }

  function onKeyDown(e) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!form.country) {
      setFormError("Veuillez choisir un pays.");
      document.getElementById("country")?.focus();
      return;
    }
    if (form.keyword.trim().length < 2) {
      setFormError(
        "Saisissez un secteur ou un nom d'entreprise (2 caractères minimum).",
      );
      return;
    }
    setFormError("");
    setOpen(false);
    onSearch({ ...form, city: form.city.trim(), keyword: form.keyword.trim() });
  }

  return (
    <section className="hero" id="recherche">
      <h1>
        Trouvez les <span className="highlight">entreprises africaines</span>{" "}
        qu'il vous faut
      </h1>
      <p className="hero-sub">
        Recherchez par secteur d'activité ou par nom, dans le pays et la ville
        de votre choix.
      </p>

      <form className="searchbar" onSubmit={submit}>
        <div className="sb-field sb-what">
          <label htmlFor="keyword">Qui, quoi ?</label>
          <div className="sb-input-wrap">
            <input
              id="keyword"
              autoComplete="off"
              placeholder="Nom d'entreprise, secteur…"
              value={form.keyword}
              onChange={(e) => {
                update("keyword")(e);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={onKeyDown}
            />
            {form.keyword && (
              <button
                type="button"
                className="sb-clear"
                aria-label="Effacer"
                onClick={() => {
                  setForm((f) => ({ ...f, keyword: "" }));
                  document.getElementById("keyword")?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
          {open && (
            <Suggestions
              query={form.keyword}
              sectors={sugg.sectors}
              companies={sugg.companies}
              activeIndex={active}
              onPickSector={(sector) =>
                pick({ type: "sector", value: { sector } })
              }
              onPickCompany={(company) =>
                pick({ type: "company", value: company })
              }
            />
          )}
        </div>

        <div className="sb-divider" />

        <div className="sb-field sb-where">
          <label htmlFor="country">Où ?</label>
          <div className="sb-where-inputs">
            <select
              id="country"
              value={form.country}
              onChange={update("country")}
              aria-label="Pays"
            >
              <option value="" disabled>
                Choisir un pays
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              id="city"
              placeholder="Ville (facultatif)"
              value={form.city}
              onChange={update("city")}
              aria-label="Ville"
            />
          </div>
        </div>

        <button className="sb-button" type="submit" disabled={loading}>
          <SearchIcon width={18} height={18} />
          {loading ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {formError && <p className="hero-error">{formError}</p>}
    </section>
  );
}

