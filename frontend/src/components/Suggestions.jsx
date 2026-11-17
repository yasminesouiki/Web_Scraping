// Liste de suggestions affichée sous "Qui, quoi ?" pendant la frappe

/** Met en gras la partie qui correspond au texte tapé : "inf" -> <b>INF</b>AD */
function Highlight({ text, query }) {
  const value = String(text || '');
  const q = query.trim().toLowerCase();
  if (!q) return value;
  const parts = [];
  let rest = value;
  let i;
  while (q && (i = rest.toLowerCase().indexOf(q)) !== -1) {
    if (i > 0) parts.push(rest.slice(0, i));
    parts.push(<strong key={parts.length}>{rest.slice(i, i + q.length)}</strong>);
    rest = rest.slice(i + q.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

export default function Suggestions({ query, sectors, companies, activeIndex, onPickSector, onPickCompany }) {
  if (!sectors.length && !companies.length) return null;
  let index = -1;

  return (
    <div className="suggestions" role="listbox">
      {sectors.length > 0 && <div className="sugg-label">Secteurs</div>}
      {sectors.map((s) => {
        index++;
        const i = index;
        return (
          <button
            key={`s-${s.sector}`}
            type="button"
            className={`sugg-item ${activeIndex === i ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPickSector(s.sector)}
          >
            <span className="sugg-title">
              <Highlight text={s.sector} query={query} />
            </span>
            <span className="sugg-sub">{s.total} entreprise(s) dans la base</span>
          </button>
        );
      })}

      {companies.length > 0 && <div className="sugg-label">Entreprises</div>}
      {companies.map((c) => {
        index++;
        const i = index;
        return (
          <button
            key={`c-${c.id}`}
            type="button"
            className={`sugg-item ${activeIndex === i ? 'active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPickCompany(c)}
          >
            <span className="sugg-title">
              <Highlight text={c.name} query={query} />
            </span>
            <span className="sugg-sub">{[c.sector, c.city, c.country].filter(Boolean).join(' · ')}</span>
          </button>
        );
      })}
    </div>
  );
}