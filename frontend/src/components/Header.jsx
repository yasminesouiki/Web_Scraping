export default function Header({ onHome }) {
  const goHome = (e) => {
    e.preventDefault();
    onHome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/" onClick={goHome}>
          <span className="brand-mark">AF</span>
          <span className="brand-text">
            Afri<strong>Search</strong>
          </span>
        </a>
        <nav className="nav">
          <a href="/" onClick={goHome}>Accueil</a>
          <a href="#recherche">Recherche</a>
          <a href="#resultats">Entreprises</a>
        </nav>
      </div>
    </header>
  );
}
