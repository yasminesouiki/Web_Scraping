import CompanyCard from './CompanyCard.jsx';

export default function ResultsList({ companies, emptyMessage }) {
  if (!companies.length) {
    return (
      <div className="empty-card">
        <strong>Aucune entreprise trouvée.</strong>
        {emptyMessage && <p className="empty-reason">{emptyMessage}</p>}
      </div>
    );
  }
  return (
    <div className="results-list">
      {companies.map((c) => (
        <CompanyCard key={c.id} company={c} />
      ))}
    </div>
  );
}