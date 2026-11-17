const LABELS = {
  live: { text: 'Collecte en direct', className: 'live' },
  cache: { text: 'Depuis la base de données', className: 'cache' },
  local: { text: 'Base locale', className: 'local' },
  history: { text: 'Historique', className: 'cache' },
};

export default function StatusBanner({ result }) {
  const label = LABELS[result.source] || LABELS.cache;
  const { stats = {} } = result;

  return (
    <div className="status-banner">
      <span className={`tag ${label.className}`}>{label.text}</span>
      <span>{result.message}</span>
      {result.source === 'live' && (
        <span className="stats">
          {stats.created} nouvelle(s) · {stats.duplicates} déjà en base (doublons évités)
          {stats.errors > 0 && ` · ${stats.errors} fiche(s) illisible(s)`}
        </span>
      )}
    </div>
  );
}
