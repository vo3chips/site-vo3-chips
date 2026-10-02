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

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return { headers: rows.shift() || [], rows };
}

function ensureViewerStyles() {
  if (document.querySelector('#csv-viewer-styles')) return;
  const style = document.createElement('style');
  style.id = 'csv-viewer-styles';
  style.textContent = `
    .csv-viewer{position:fixed;inset:0;z-index:1000;background:rgba(10,15,16,.82);display:flex;align-items:center;justify-content:center;padding:20px}
    .csv-panel{background:#fff;color:#161b1d;width:min(1180px,100%);max-height:92vh;overflow:auto;border-radius:10px;padding:28px;box-shadow:0 20px 70px rgba(0,0,0,.35)}
    .csv-panel h2{margin:4px 0 20px;font-size:clamp(24px,3vw,40px)}
    .csv-close{float:right;border:0;background:#161b1d;color:#fff;border-radius:50%;width:36px;height:36px;font-size:25px;cursor:pointer}
    .csv-search-box{display:flex;gap:12px;align-items:end;margin:16px 0}
    .csv-search-box label{display:block;flex:1;font-weight:700}
    .csv-search-box input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:2px solid #9aa5a8;border-radius:6px;font-size:16px}
    .csv-count{font-weight:700;margin:10px 0}
    .csv-table-wrap{overflow:auto;border:1px solid #9aa5a8}
    .csv-table{border-collapse:collapse;width:100%;min-width:900px;font-size:11px;table-layout:fixed}.csv-table th:nth-child(3),.csv-table td:nth-child(3){width:24%;max-width:280px;white-space:normal;word-break:normal;overflow-wrap:break-word}.csv-table th:nth-child(8),.csv-table td:nth-child(8){width:16%;max-width:190px;white-space:normal;overflow-wrap:anywhere}
    .csv-table th,.csv-table td{border:1px solid #b7c0c2;padding:9px 10px;text-align:left;white-space:nowrap;vertical-align:middle}
    .csv-table th{background:#e9eff0;color:#111;font-weight:800;position:sticky;top:0;z-index:1}
    .csv-table tr:nth-child(even){background:#f7f9f9}
    .csv-pdfs{margin-top:26px;border-top:2px solid #dce3e4;padding-top:18px}
    .csv-pdfs h3{margin:0 0 12px;font-size:20px}
    .csv-pdf-list{display:flex;flex-wrap:wrap;gap:10px}
    .csv-pdf-link{display:inline-block;border:1px solid #738184;border-radius:5px;padding:10px 12px;color:#111;text-decoration:none;background:#f4f7f7;font-weight:700}
    .csv-pdf-link:hover{background:#dff000}
    @media(max-width:650px){.csv-panel{padding:18px}.csv-search-box{display:block}.csv-search-box label{margin-bottom:12px}}
  `;
  document.head.append(style);
}

function openCSVResult(race, result) {
  ensureViewerStyles();
  document.querySelector('#csv-viewer')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'csv-viewer';
  overlay.className = 'csv-viewer';
  overlay.innerHTML = `
    <section class="csv-panel" role="dialog" aria-modal="true" aria-label="Consulta de resultados">
      <button class="csv-close" type="button" aria-label="Fechar">×</button>
      <p class="eyebrow dark">RESULTADO PESQUISÁVEL</p>
      <h2>${escapeHTML(race.name)}</h2>
      <p>Pesquise pelo número, nome do atleta ou equipe.</p>
      <div class="csv-search-box"><label>Buscar resultado<input class="csv-search" type="search" placeholder="Digite número, nome ou equipe" aria-label="Buscar por número, nome ou equipe"></label></div>
      <p class="csv-count">Carregando resultados…</p>
      <div class="csv-table-wrap"><table class="csv-table"><thead></thead><tbody></tbody></table></div>
      <div class="csv-pdfs"><h3>PDFs oficiais da prova</h3><div class="csv-pdf-list"></div></div>
    </section>`;
  document.body.append(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.csv-close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  const pdfList = overlay.querySelector('.csv-pdf-list');
  (race.pdfs || []).forEach(([label, file]) => {
    const link = document.createElement('a');
    link.className = 'csv-pdf-link'; link.href = file; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = 'Baixar PDF · ' + label; pdfList.append(link);
  });
  fetch(result.file).then(response => { if (!response.ok) throw Error(); return response.text(); }).then(text => {
    const data = parseCSV(text);
    const labels = { 'Colocação':'COL', 'Número':'Nº', 'Atleta':'ATLETA', 'Sexo':'SEXO', 'Categoria':'CAT', 'Faixa etária':'F. ETÁRIA', 'Categoria faixa':'COL FAIXA', 'Equipe':'EQUIPE', 'Ritmo':'RITMO', 'Tempo':'TEMPO' };
    const displayHeaders = data.headers.map(h => labels[h] || h);
    const modalityIndex = data.headers.findIndex(h => /modalidade|distancia|distância/i.test(h));
    const distance = result.distance || (race.distances && race.distances[0]) || '';
    if (modalityIndex < 0) { const catPos = displayHeaders.findIndex(h => h === 'CAT'); displayHeaders.splice(catPos < 0 ? 0 : catPos, 0, 'MOD'); }
    overlay.querySelector('thead').innerHTML = '<tr>' + displayHeaders.map(h => '<th>' + escapeHTML(h) + '</th>').join('') + '</tr>';
    const search = overlay.querySelector('.csv-search');
    const searchable = data.headers.map((h, i) => ({h: normalize(h), i})).filter(x => /numero|atleta|nome|equipe/.test(x.h)).map(x => x.i);
    const update = () => {
      const term = normalize(search.value.trim());
      const rows = data.rows.filter(row => !term || searchable.some(i => normalize(row[i]).includes(term)));
      overlay.querySelector('tbody').innerHTML = rows.slice(0, 500).map(row => {
        const values = data.headers.map((_, i) => row[i]);
        if (modalityIndex < 0) { const catPos = data.headers.findIndex(h => /categoria/i.test(h)); values.splice(catPos < 0 ? 0 : catPos, 0, distance); }
        return '<tr>' + values.map(v => '<td>' + escapeHTML(v) + '</td>').join('') + '</tr>';
      }).join('');
      overlay.querySelector('.csv-count').textContent = rows.length + (rows.length === 1 ? ' resultado encontrado' : ' resultados encontrados');
    };
    search.addEventListener('input', update); update(); search.focus();
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
  el.count.textContent = hasFilters ? `${filtered.length} ${filtered.length === 1 ? 'prova encontrada' : 'provas encontradas'}` : `Exibindo ${visible.length} de ${filtered.length} provas`;
  el.empty.hidden = filtered.length > 0;
  el.showMore.hidden = hasFilters || filtered.length <= 3;
  el.showMore.textContent = state.showAll ? 'Ver menos resultados' : 'Ver mais resultados';
  el.showMore.setAttribute('aria-expanded', String(state.showAll));
  el.list.innerHTML = visible.map(race => {
    const results = race.results || [];
    const linkFor = (result, index) => '<a class="race-link ' + (result.file.toLowerCase().endsWith('.csv') ? 'csv-result' : '') + '" href="' + result.file + '" data-index="' + index + '" target="_blank" rel="noopener">' + (result.file.toLowerCase().endsWith('.csv') ? 'Consultar resultado' : 'Baixar PDF') + ' · ' + [result.sport, result.distance, result.category, result.sex].filter(Boolean).join(' · ') + ' →</a>';
    let action = '<span class="race-link">Resultado em preparação</span>';
    if (results.length === 1) action = linkFor(results[0], 0);
    else if (results.length > 1) action = '<details class="race-results"><summary>Ver ' + results.length + ' resultados</summary><div class="race-links">' + results.map(linkFor).join('') + '</div></details>';
    return '<article class="race-card" data-id="' + escapeHTML(race.id) + '" data-format="' + escapeHTML(race.format) + '"><span class="race-year">' + escapeHTML(race.year) + '</span><h3>' + escapeHTML(race.name) + '</h3><p class="race-location">' + escapeHTML(race.city) + ' · ' + escapeHTML(race.state) + (race.date ? ' · ' + race.date.split('-').reverse().join('/') : '') + '</p><div class="race-tags"><span class="tag">' + escapeHTML(race.sport) + '</span><span class="tag">' + escapeHTML(race.format) + '</span></div>' + action + '</article>';
  }).join('');
  el.list.querySelectorAll('a.csv-result').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const race = state.races.find(r => r.id === link.closest('.race-card').dataset.id);
    const result = race.results[Number(link.dataset.index)];
    openCSVResult(race, result);
  }));

}

async function loadRaces() {
  try {
    const response = await fetch('data/provas.json');
    if (!response.ok) throw Error();
    state.races = (await response.json()).sort((a,b) => String(b.date).localeCompare(String(a.date)));
    [...new Set(state.races.map(r => r.year))].sort((a,b) => b-a).forEach(year => el.year.insertAdjacentHTML('beforeend', '<option value="' + year + '">' + year + '</option>'));
    render();
  } catch {
    el.count.textContent = 'Os resultados não puderam ser carregados.';
    el.empty.hidden = false;
  }
}
[el.search, el.year, el.sport].forEach(input => input.addEventListener('input', render));
el.clear.addEventListener('click', () => { el.search.value=''; el.year.value=''; el.sport.value=''; state.showAll=false; render(); el.search.focus(); });
el.showMore.addEventListener('click', () => { state.showAll=!state.showAll; render(); if (!state.showAll) document.querySelector('#resultados').scrollIntoView({behavior:'smooth'}); });
document.querySelector('#current-year').textContent = new Date().getFullYear();
loadRaces();
