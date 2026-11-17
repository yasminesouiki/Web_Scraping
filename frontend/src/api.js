// Appels vers l'API backend
const API = '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error("Impossible de contacter le serveur. Vérifiez que le backend est lancé (npm run dev dans /backend).");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const getCountries = () => request('/countries');

export const searchCompanies = ({ country, city, keyword, refresh }) =>
  request('/search', { method: 'POST', body: JSON.stringify({ country, city, keyword, refresh }) });

export const getSearches = () => request('/searches?limit=2');

export const getSearchResults = (id) => request(`/searches/${id}/results`);

export const exportUrl = (searchId) => `${API}/export.csv?searchId=${searchId}`;

export const getSuggestions = (q, country) =>
  request(`/suggest?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country || '')}`);