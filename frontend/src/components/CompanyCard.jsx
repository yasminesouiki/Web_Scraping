import { PinIcon, PhoneIcon, MailIcon, GlobeIcon, FileIcon } from './Icons.jsx';

// "34 Rue X, Gouvernorat de Tunis, Tunis - 1002 - Tunisie" -> une ligne par partie
function addressLines(address) {
  return String(address || '')
    .split(/,\s*/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export default function CompanyCard({ company }) {
  const lines = addressLines(company.address);
  const phones = company.phone ? company.phone.split(' / ') : [];
  const emails = company.email ? company.email.split(' / ') : [];

  return (
    <article className="company-card">
      <h3 className="company-name">{company.name}</h3>
      {company.sector && <p className="company-sector">{company.sector}</p>}

      <div className="company-body">
        <div className="company-address">
          <PinIcon className="icon muted-icon" />
          <div>
            {lines.length ? (
              lines.map((l, i) => <div key={i}>{l}</div>)
            ) : (
              <div>
                {[company.city, company.country].filter(Boolean).join(' - ') || 'Adresse non communiquée'}
              </div>
            )}
          </div>
        </div>

        <div className="company-contacts">
          {phones.map((p) => (
            <a key={p} className="contact-line" href={`tel:${p.replace(/[^\d+]/g, '')}`}>
              <PhoneIcon className="icon muted-icon" />
              <span>Tél : {p}</span>
            </a>
          ))}
          {emails.map((e) => (
            <a key={e} className="contact-line" href={`mailto:${e}`}>
              <MailIcon className="icon muted-icon" />
              <span>{e}</span>
            </a>
          ))}
          {!phones.length && !emails.length && <span className="muted">Aucun contact communiqué</span>}
        </div>
      </div>

      <div className="company-actions">
        <a className="action" href={company.sourceUrl} target="_blank" rel="noreferrer">
          <span className="action-icon"><FileIcon width={18} height={18} /></span>
          Fiche source
        </a>
        {company.website && (
          <a className="action" href={company.website} target="_blank" rel="noreferrer">
            <span className="action-icon"><GlobeIcon width={18} height={18} /></span>
            {shortUrl(company.website)}
          </a>
        )}
        {lines.length > 0 && (
          <a
            className="action"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company.name} ${company.address}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="action-icon"><PinIcon width={18} height={18} /></span>
            Itinéraire
          </a>
        )}
      </div>
    </article>
  );
}
