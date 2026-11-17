import CompanyCard from './CompanyCard.jsx';

export default function ResultsList({ companies }) {
  if (!companies.length) {
    return <div className="empty-card">Aucune entreprise à afficher pour cette recherche.</div>;
  }
  return (
    <div className="results-list">
      {companies.map((c) => (
        <CompanyCard key={c.id} company={c} />
      ))}
    </div>
  );
}
