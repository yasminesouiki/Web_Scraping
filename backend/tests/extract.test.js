// Tests des fonctions "pures" (sans Internet ni base de données) : npm test
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeText, slugify, titleCase, normalizePhone } = require('../src/utils/normalize');
const { extractJsonLd, findPhonesInText, findEmailsInText, cityFromAddress, unwrapRedirect, isExternalUrl } = require('../src/collector/extract');
const { matchCategories } = require('../src/collector/matcher');
const { parseRobots, isPathAllowed } = require('../src/collector/robots');
const { toCsv } = require('../src/utils/csv');
const { getCountry } = require('../src/collector/countries');

test('normalisation du texte', () => {
  assert.equal(normalizeText("Côte d'Ivoire"), 'cote d ivoire');
  assert.equal(slugify('Saint Louis'), 'saint-louis');
  assert.equal(titleCase('SAINT-LOUIS'), 'Saint-Louis');
  assert.equal(normalizePhone('Tel: +221 33.123.45.67'), '+221 33 123 45 67');
});

test('pays par code ou par nom', () => {
  assert.equal(getCountry('sn').name, 'Sénégal');
  assert.equal(getCountry('senegal').code, 'sn');
  assert.equal(getCountry("cote d'ivoire").code, 'ci');
  assert.equal(getCountry('Tunisia').code, 'tn');
  assert.equal(getCountry('france'), null);
});

test('mot-clé -> secteurs', () => {
  const cats = [
    { slug: 'informatique-internet', label: 'Informatique, internet', url: 'x' },
    { slug: 'agences-de-communication', label: 'Agences de communication', url: 'x' },
    { slug: 'communication-publicite', label: 'Communication, publicité', url: 'x' },
    { slug: 'banques', label: 'Banques', url: 'x' },
    { slug: 'restaurants', label: 'Restaurants', url: 'x' },
  ];
  assert.equal(matchCategories(cats, 'info')[0].slug, 'informatique-internet');
  assert.equal(matchCategories(cats, 'banque')[0].slug, 'banques');
  assert.ok(matchCategories(cats, 'marketing').some((c) => c.slug.includes('communication')));
  assert.equal(matchCategories(cats, 'Communication', 1)[0].slug, 'communication-publicite');
  assert.deepEqual(matchCategories(cats, 'zzz'), []);
});

test('données structurées JSON-LD', () => {
  const ld = extractJsonLd([
    'invalide{',
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Page' },
        {
          '@type': 'LocalBusiness',
          name: 'DICAN',
          telephone: '+221 33 000 00 00',
          email: 'mailto:contact@dican.sn',
          url: 'https://dican.sn',
          address: { '@type': 'PostalAddress', streetAddress: 'Rue 10', addressLocality: 'Dakar', addressCountry: 'SN' },
        },
      ],
    }),
  ]);
  assert.equal(ld.name, 'DICAN');
  assert.equal(ld.email, 'contact@dican.sn');
  assert.equal(ld.locality, 'Dakar');
  assert.equal(ld.address, 'Rue 10, Dakar, SN');
  assert.equal(extractJsonLd(['{"@type":"WebPage"}']), null);
});

test('téléphones et emails dans le texte', () => {
  assert.deepEqual(findPhonesInText('Gsm:  216 71 83 27 97'), ['216 71 83 27 97']);
  const text = 'Tel: +221 33 869 00 00 Gsm : 77 123 45 67 Fax: 33 000 00 00 contact@acme.sn support@goafricaonline.com logo@2x.png';
  assert.deepEqual(findPhonesInText(text), ['+221 33 869 00 00', '77 123 45 67']);
  assert.deepEqual(findEmailsInText(text), ['contact@acme.sn']);
});

test('ville à partir de l\'adresse', () => {
  assert.equal(
    cityFromAddress('Imm. Rouge, derrière mosquée Kébé - Coléah Centre Matam - BP 350 Conakry - Guinée', 'Guinée'),
    'Conakry'
  );
  assert.equal(cityFromAddress('Rue 10 x 13, Médina - Dakar - Sénégal', 'Sénégal'), 'Dakar');
  // format réel vu sur le site (version anglaise) : code postal entre la ville et le pays
  assert.equal(
    cityFromAddress('34 Rue de La Palestine, Gouvernorat de Tunis, Tunis - 1002 - Tunisia', ['Tunisie', 'Tunisia']),
    'Tunis'
  );
  assert.equal(
    cityFromAddress('22 Av. Alain Savary - Cite Jardins, Gouvernorat de Tunis, Tunis - 1002 - Tunisie', ['Tunisie', 'Tunisia']),
    'Tunis'
  );
  assert.equal(cityFromAddress('Adresse inconnue', 'Sénégal'), '');
});

test('liens externes et redirections', () => {
  assert.equal(unwrapRedirect('https://www.goafricaonline.com/redirect?url=https%3A%2F%2Facme.sn'), 'https://acme.sn');
  assert.equal(isExternalUrl('https://acme.sn', 'www.goafricaonline.com'), true);
  assert.equal(isExternalUrl('https://www.goafricaonline.com/sn/1-x', 'www.goafricaonline.com'), false);
});

test('robots.txt', () => {
  const rules = parseRobots(`
    User-agent: Googlebot
    Disallow: /

    User-agent: *
    Disallow: /admin
    Disallow: /*?q=
    Allow: /admin/public
  `);
  assert.equal(isPathAllowed('/sn/annuaire/banques', rules), true);
  assert.equal(isPathAllowed('/admin/users', rules), false);
  assert.equal(isPathAllowed('/admin/public/page', rules), true);
  assert.equal(isPathAllowed('/sn/recherche?q=test', rules), false);
});

test('export CSV compatible Excel', () => {
  const csv = toCsv([{ a: 'x;y', b: 'il dit "ok"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'A;B\r\n"x;y";"il dit ""ok"""');
});
