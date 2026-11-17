// Section "Quel est votre besoin ?" affichée sous la barre de recherche (page d'accueil)

const ICONS = {
  building: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="11" height="18" rx="1.5" /><path d="M8 7h3M8 11h3M8 15h3" /><circle cx="17.5" cy="15.5" r="3" /><path d="m19.8 17.8 2 2" />
    </svg>
  ),
  tags: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16" /><path d="M7 16v-4M11 16V9M15 16v-6M19 16V5" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  ),
};

const POPULAR = ['Informatique', 'Banque', 'Transport', 'Hôtel', 'Communication', 'BTP'];

const Arrow = () => <span className="pill-arrow">→</span>;

const focusField = (id) => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => document.getElementById(id)?.focus(), 300);
};

export default function Features({ countriesCount, lastSearch, onQuickSearch, onOpenSearch, exportHref }) {
  return (
    <section className="features">
      <h2 className="features-title">
        Quel est votre <span className="blue">besoin professionnel</span> ?
      </h2>
      <p className="features-sub">
        Trouvez vos futurs clients, fournisseurs et partenaires partout en Afrique.
      </p>

      <div className="features-grid">
        {/* 1. Annuaire */}
        <article className="feature-card">
          <div className="feature-icon blue-soft">{ICONS.building}</div>
          <h3>Trouver un fournisseur</h3>
          <p>Recherchez parmi des milliers d'entreprises par secteur d'activité ou par nom.</p>
          <button type="button" className="pill pill-blue" onClick={() => focusField('keyword')}>
            Annuaire <Arrow />
          </button>
        </article>

        {/* 2. Secteurs populaires */}
        <article className="feature-card">
          <div className="feature-icon teal-soft">{ICONS.tags}</div>
          <h3>Secteurs populaires</h3>
          <p>Lancez une recherche en un clic dans le pays sélectionné.</p>
          <div className="chips">
            {POPULAR.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => onQuickSearch(s)}>
                {s}
              </button>
            ))}
          </div>
        </article>

        {/* 3. Carte mise en avant */}
        <article className="feature-card featured">
          <span className="badge">EN DIRECT</span>
          <div className="feature-icon dark-soft">{ICONS.bolt}</div>
          <h3>Collecte automatique</h3>
          <p>Les données sont collectées en temps réel, enregistrées sans doublons et toujours liées à leur source.</p>
          <button type="button" className="pill pill-yellow" onClick={() => focusField('keyword')}>
            Lancer une recherche <Arrow />
          </button>
        </article>

        {/* 4. Export */}
        <article className="feature-card">
          <div className="feature-icon purple-soft">{ICONS.download}</div>
          <h3>Exporter vos prospects</h3>
          <p>Téléchargez les résultats en CSV, compatibles Excel, pour votre prospection.</p>
          {exportHref ? (
            <a className="pill pill-purple" href={exportHref}>
              Exporter la dernière recherche <Arrow />
            </a>
          ) : (
            <button type="button" className="pill pill-purple" onClick={() => focusField('keyword')}>
              Faire une recherche <Arrow />
            </button>
          )}
        </article>

        {/* 5. Historique */}
        <article className="feature-card">
          <div className="feature-icon orange-soft">{ICONS.clock}</div>
          <h3>Retrouver vos recherches</h3>
          <p>Chaque recherche est enregistrée : ses résultats s'affichent instantanément depuis la base.</p>
          {lastSearch ? (
            <button type="button" className="pill pill-orange" onClick={() => onOpenSearch(lastSearch.id)}>
              Dernière : {lastSearch.keyword} <Arrow />
            </button>
          ) : (
            <span className="pill pill-orange disabled">Aucune recherche pour l'instant</span>
          )}
        </article>

        {/* 6. Pays */}
        <article className="feature-card">
          <div className="feature-icon pink-soft">{ICONS.globe}</div>
          <h3>{countriesCount || 34} pays africains</h3>
          <p>Du Maroc à l'Afrique du Sud, choisissez le pays puis affinez par ville.</p>
          <button type="button" className="pill pill-pink" onClick={() => focusField('country')}>
            Choisir un pays <Arrow />
          </button>
        </article>
      </div>
    </section>
  );
}
