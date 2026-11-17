// Lecture simplifiée du fichier robots.txt (règles pour "User-agent: *")
// But : ne jamais collecter une page que le site interdit aux robots.

/** Transforme le texte du robots.txt en liste de règles { allow, path }. */
function parseRobots(text) {
  const rules = [];
  let appliesToUs = false;
  let lastLineWasAgent = false;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      // Plusieurs lignes User-agent à la suite = même groupe
      appliesToUs = lastLineWasAgent ? appliesToUs || value === '*' : value === '*';
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (!appliesToUs) continue;
    if (field === 'disallow' && value) rules.push({ allow: false, path: value });
    if (field === 'allow' && value) rules.push({ allow: true, path: value });
  }
  return rules;
}

function ruleToRegex(path) {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const anchoredEnd = escaped.endsWith('\\$') ? escaped.slice(0, -2) + '$' : escaped;
  return new RegExp('^' + anchoredEnd);
}

/** La règle la plus longue qui correspond l'emporte (comme Google). */
function isPathAllowed(pathWithQuery, rules) {
  let best = null;
  for (const rule of rules) {
    if (ruleToRegex(rule.path).test(pathWithQuery)) {
      if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) {
        best = rule;
      }
    }
  }
  return best ? best.allow : true;
}

module.exports = { parseRobots, isPathAllowed };
