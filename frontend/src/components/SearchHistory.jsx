const STATUS = { done: '✔', failed: '✖', running: '…' };

export default function SearchHistory({ searches, onOpen }) {
  return (
    <div className="side-card" id="historique">
      <h3>Dernières recherches</h3>
      {!searches.length && <p className="muted">Aucune recherche pour le moment.</p>}
      <ul className="history-list">
        {searches.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onOpen(s.id)} disabled={s.status !== 'done'}>
              <span className="history-title">
                <span className={`dot ${s.status}`}>{STATUS[s.status]}</span> {s.keyword}
              </span>
              <span className="history-meta">
                {s.country}
                {s.city ? ` · ${s.city}` : ''} · {s.resultsCount} résultat(s)
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
