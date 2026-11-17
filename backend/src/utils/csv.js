// Génération d'un fichier CSV lisible par Excel (séparateur ";" + BOM UTF-8)

const BOM = '﻿';

function escapeCell(value, separator) {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes('"') || text.includes(separator) || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * @param {Array<object>} rows    données
 * @param {Array<{key:string,label:string}>} columns  colonnes à exporter
 */
function toCsv(rows, columns, separator = ';') {
  const header = columns.map((c) => escapeCell(c.label, separator)).join(separator);
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key], separator)).join(separator));
  return BOM + [header, ...lines].join('\r\n');
}

module.exports = { toCsv };
