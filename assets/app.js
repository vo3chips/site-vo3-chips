const state = { races: [], showAll: false };
const el = {
  search: document.querySelector('#search'),
  year: document.querySelector('#year-filter'),
  sport: document.querySelector('#sport-filter'),
  list: document.querySelector('#race-list'),
  count: document.querySelector('#result-count'),
  empty: document.querySelector('#empty-state'),
  clear: document.querySelector('#clear-filters'),
  showMore: document.querySelector('#show-more-results')
};

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) || []).length >= (text.split(/\r?\n/, 1)[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\\n' || c === '\\r') && !quoted) { if (c === '\\r' && text[i + 1] === '\\n') i++; row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return { headers: rows.shift() || [], rows };
}

function openCSVResult(url, title) {
  const existing = document.querySelector('#csv-viewer'); if (existing) existing.remove();
  const overlay = document.createElement('div'); overlay.id = 'csv-viewer'; overlay.className = 'csv-viewer';
  overlay.innerHTML = \`
    <div class="csv-panel" role="dialog" aria-modal="true" aria-label="Consulta de resultados">
      <button class="csv-close" type="button" aria-label="Fechar">×</button>
      <p class="eyebrow dark">RESULTADO PESQUISÁVEL</p><h2>\${title}</h2>
      <div class="csv-tools"><input class="csv-search" type="search" placeholder="Buscar por nome ou número" aria-label="Buscar por nome ou número"><select class="csv-category" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option></select></div>
      <p class="csv-count">Carregando resultados…</p><div class="csv-table-wrap"><table><thead></thead><tbody></tbody></table></div>
    </div>\`;
  document.body.append(overlay);
  const close = () => overlay.remove(); overlay.querySelector('.csv-close').addEventListener('click', close); overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  fetch(url).then(r => { if (!r.ok) throw Error(); return r.text(); }).then(text => {
    const data = parseCSV(text), search = overlay.querySelector('.csv-search'), category = overlay.querySelector('.csv-category');
    const catIndex = data.headers.findIndex(h => /categoria|faixa/i.test(h));
    if (catIndex >= 0) [...new Set(data.rows.map(r => r[catIndex]).filter(Boolean))].sort().forEach(v => category.add(new Option(v, v)));
    overlay.querySelector('thead').innerHTML = '<tr>' + data.headers.map(h => '<th>' + h + '</th>').join('') + '</tr>';
    const update = () => {
      const term = normalize(search.value), cat = category.value;
      const rows = data.rows.filter(r => (!term || normalize(r.join(' ')).includes(term)) && (!cat || r[catIndex] === cat));
      overlay.querySelector('tbody').innerHTML = rows.slice(0, 500).map(r => '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>').join('');
      overlay.querySelector('.csv-count').textContent = rows.length + (rows.length === 1 ? ' resultado encontrado' : ' resultados encontrados');
    };
    search.addEventListener('input', update); category.addEventListener('change', update); update(); search.focus();
  }).catch(() => { overlay.querySelector('.csv-count').textContent = 'Não foi possível carregar os resultados.'; });
}

function render() {
  const term = normalize(el.search.value);
  const year = el.year.value;
  const sport = el.sport.value;
  const filtered = state.races.filter(race => {
    const resultTerms = (race.results || []).map(result => `${result.distance} ${result.category} ${result.sex}`).join(' ');
    const haystack = normalize(`${race.name} ${race.city} ${race.state} ${race.year} ${race.sport} ${resultTerms}`);
    return (!term || haystack.includes(term)) && (!year || String(race.year) === year) && (!sport || (race.sports || [race.sport]).includes(sport));
  });
  const hasFilters = Boolean(term || year || sport);
  const visible = hasFilters || state.showAll ? filtered : filtered.slice(0, 3);
  el.count.textContent = hasFilters
    ? `${filtered.length} ${filtered.length === 1 ? 'prova encontrada' : 'provas encontradas'}`
    : `Exibindo ${visible.length} de ${filtered.length} provas`;
  el.empty.hidden = filtered.length > 0;
  el.showMore.hidden = hasFilters || filtered.length <= 3;
  el.showMore.textContent = state.showAll ? 'Ver menos resultados' : 'Ver mais resultados';
  el.showMore.setAttribute('aria-expanded', String(state.showAll));
  el.list.innerHTML = visible.map(race => `
    <article class="race-card" data-format="${race.format}">
      <span class="race-year">${race.year}</span>
      <h3>${race.name}</h3>
      <p class="race-location">${race.city} · ${race.state}${race.date ? ` · ${race.date.split('-').reverse().join('/')}` : ''}</p>
      <div class="race-tags"><span class="tag">${race.sport}</span><span class="tag">${race.format}</span></div>
      ${(race.results || []).length === 1 ? `<a class="race-link ${race.results[0].file.toLowerCase().endsWith('.csv') ? 'csv-result' : ''}" href="${race.results[0].file}" data-csv="${race.results[0].file}" data-title="${race.name}" target="_blank" rel="noopener">${[race.results[0].sport, race.results[0].distance, race.results[0].category, race.results[0].sex].filter(Boolean).join(' · ')} →</a>` : (race.results || []).length > 1 ? `<details class="race-results"><summary>Ver ${race.results.length} resultados</summary><div class="race-links">${race.results.map(result => `<a class="race-link ${result.file.toLowerCase().endsWith('.csv') ? 'csv-result' : ''}" href="${result.file}" data-csv="${result.file}" data-title="${race.name}" target="_blank" rel="noopener">${[result.sport, result.distance, result.category, result.sex].filter(Boolean).join(' · ')} →</a>`).join('')}</div></details>` : race.file ? `<a class="race-link" href="${race.file}">${race.format === 'CSV' ? 'Consultar atletas →' : 'Abrir resultado →'}</a>` : '<span class="race-link" aria-disabled="true">Resultado em preparação</span>'}
    </article>`).join('');
  el.list.querySelectorAll('a.csv-result').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openCSVResult(link.dataset.csv, link.dataset.title); }));
}

async function loadRaces() {
  try {
    const response = await fetch('data/provas.json');
    if (!response.ok) throw new Error('Falha ao carregar');
    state.races = (await response.json()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    [...new Set(state.races.map(r => r.year))].sort((a,b) => b-a).forEach(year => el.year.insertAdjacentHTML('beforeend', `<option value="${year}">${year}</option>`));
    render();
  } catch {
    el.count.textContent = 'Os resultados não puderam ser carregados.';
    el.empty.hidden = false;
  }
}

[el.search, el.year, el.sport].forEach(input => input.addEventListener('input', render));
el.clear.addEventListener('click', () => { el.search.value = ''; el.year.value = ''; el.sport.value = ''; state.showAll = false; render(); el.search.focus(); });
el.showMore.addEventListener('click', () => {
  state.showAll = !state.showAll;
  render();
  if (!state.showAll) document.querySelector('#resultados').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#current-year').textContent = new Date().getFullYear();
loadRaces();
