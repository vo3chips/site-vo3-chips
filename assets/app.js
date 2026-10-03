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
    .csv-viewer{position:fixed;inset:0;z-index:1000;background:rgba(10,15,16,.82);display:flex;align-items:center;justify-content:center;padding:12px}
    .csv-panel{background:#fff;color:#161b1d;width:min(1600px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;border-radius:10px;padding:24px;box-shadow:0 20px 70px rgba(0,0,0,.35)}
    .csv-panel h2{margin:4px 0 20px;font-size:clamp(24px,3vw,40px)}
    .csv-close{float:right;border:0;background:#161b1d;color:#fff;border-radius:50%;width:36px;height:36px;font-size:25px;cursor:pointer}
    .csv-search-box{display:flex;gap:12px;align-items:end;margin:16px 0}
    .csv-search-box label{display:block;flex:1;font-weight:700}
    .csv-search-box input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:13px 14px;border:2px solid #9aa5a8;border-radius:6px;font-size:16px}
    .csv-count{font-weight:700;margin:10px 0}
    .csv-table-wrap{width:100%;max-width:100%;overflow:auto;border:1px solid #9aa5a8}
    .csv-table{border-collapse:collapse;width:max-content;min-width:100%;font-size:11px;table-layout:auto}.csv-table .csv-col-athlete{min-width:220px;max-width:340px;white-space:normal;overflow-wrap:break-word}.csv-table .csv-col-team{min-width:190px;max-width:320px;white-space:normal;overflow-wrap:break-word}
    .csv-table th,.csv-table td{border:1px solid #b7c0c2;padding:9px 4px;text-align:left;white-space:nowrap;vertical-align:middle}
    .csv-table th{background:#e9eff0;color:#111;font-weight:800;position:sticky;top:0;z-index:1}
    .csv-table tr:nth-child(even){background:#f7f9f9}
    .csv-mobile-results{display:none}
    .csv-pagination{display:flex;justify-content:center;align-items:center;gap:14px;margin:16px 0 4px}
    .csv-page-button{min-width:100px;border:1px solid #596568;border-radius:5px;padding:10px 14px;background:#161b1d;color:#fff;font-weight:700;cursor:pointer}
    .csv-page-button:disabled{opacity:.38;cursor:not-allowed}
    .csv-page-status{font-weight:700;text-align:center}
    .csv-pdfs{margin-top:26px;border-top:2px solid #dce3e4;padding-top:18px}
    .csv-pdfs h3{margin:0 0 12px;font-size:20px}
    .csv-pdf-list{display:flex;flex-wrap:wrap;gap:10px}
    .csv-pdf-link{display:inline-block;border:1px solid #738184;border-radius:5px;padding:10px 12px;color:#111;text-decoration:none;background:#f4f7f7;font-weight:700}
    .csv-pdf-link:hover{background:#dff000}
    @media(max-width:650px){.csv-viewer{padding:6px}.csv-panel{width:calc(100vw - 12px);max-height:calc(100vh - 12px);padding:16px}.csv-panel h2{font-size:28px}.csv-search-box{display:block}.csv-search-box label{margin-bottom:12px}.csv-table-wrap{display:none}.csv-mobile-results{display:grid;gap:12px}.csv-mobile-card{border:1px solid #9aa5a8;border-radius:7px;background:#fff;overflow:hidden}.csv-mobile-row{display:grid;grid-template-columns:minmax(92px,38%) minmax(0,1fr);border-bottom:1px solid #d7ddde}.csv-mobile-row:last-child{border-bottom:0}.csv-mobile-label{padding:8px;background:#e9eff0;font-size:12px;font-weight:800}.csv-mobile-value{padding:8px;font-size:13px;overflow-wrap:anywhere}.csv-pagination{gap:8px}.csv-page-button{min-width:82px;padding:11px 9px}.csv-page-status{font-size:13px}}
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
      <p>Pesquise por número, atleta, equipe, modalidade, sexo, faixa etária, categoria ou cidade.</p>
      <div class="csv-search-box"><label>Buscar resultado<input class="csv-search" type="search" placeholder="Digite qualquer informação do resultado" aria-label="Buscar por número, atleta, equipe, modalidade, sexo, faixa etária, categoria ou cidade"></label></div>
      <p class="csv-count">Carregando resultados…</p>
      <div class="csv-table-wrap"><table class="csv-table"><thead></thead><tbody></tbody></table></div>
      <div class="csv-mobile-results" aria-label="Resultados"></div>
      <nav class="csv-pagination" aria-label="Paginação dos resultados">
        <button class="csv-page-button csv-page-prev" type="button">Anterior</button>
        <span class="csv-page-status" aria-live="polite"></span>
        <button class="csv-page-button csv-page-next" type="button">Próxima</button>
      </nav>
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
    link.textContent = ' · ' + label; pdfList.append(link);
  });
  fetch(result.file).then(response => { if (!response.ok) throw Error(); return response.text(); }).then(text => {
    const data = parseCSV(text);
    const labels = { 'mod':'MOD', 'sexo':'SEXO', 'col':'COL', 'colocacao':'COL', 'num':'Nº', 'numero':'Nº', 'nº':'Nº', 'atleta':'ATLETA', 'nome':'ATLETA', 'f etaria':'F. ETÁRIA', 'faixa etaria':'F. ETÁRIA', 'c fx':'COL FAIXA', 'categoria faixa':'COL FAIXA', 'col faixa':'COL FAIXA', 'cat':'CAT', 'categoria':'CAT', 'c cat':'COL CAT', 'col cat':'COL CAT', 'equipe':'EQUIPE', 'cidade':'CIDADE', 'ritmo':'RITMO', 'pace':'RITMO', 'tempo':'TEMPO', 't liquido':'T. LÍQUIDO', 't. liquido':'T. LÍQUIDO' };
    const displayHeaders = data.headers.map(h => labels[normalize(h)] || h);
    const columnClasses = displayHeaders.map(h => /atleta|nome/i.test(h) ? 'csv-col-athlete' : /equipe/i.test(h) ? 'csv-col-team' : '');
    const modalityIndex = data.headers.findIndex(h => /^(mod|modalidade|distancia)$/.test(normalize(h)));
    const distance = result.distance || (race.distances && race.distances[0]) || '';
    if (modalityIndex < 0) { const catPos = displayHeaders.findIndex(h => h === 'CAT'); const insertAt = catPos < 0 ? 0 : catPos; displayHeaders.splice(insertAt, 0, 'MOD'); columnClasses.splice(insertAt, 0, ''); }
    overlay.querySelector('thead').innerHTML = '<tr>' + displayHeaders.map((h, i) => '<th class="' + columnClasses[i] + '">' + escapeHTML(h) + '</th>').join('') + '</tr>';
    const search = overlay.querySelector('.csv-search');
    const searchable = data.headers.map((h, i) => ({h: normalize(h), i})).filter(x => /^(num|numero|nº|no|atleta|nome|equipe|mod|modalidade|distancia|sexo|f etaria|f\\. etaria|faixa etaria|cat|categoria|cidade)$/.test(x.h)).map(x => x.i);
    const numberColumn = data.headers.findIndex(h => /^(num|numero|nº|no)$/.test(normalize(h)));
    const pagination = overlay.querySelector('.csv-pagination');
    const previous = overlay.querySelector('.csv-page-prev');
    const next = overlay.querySelector('.csv-page-next');
    const pageStatus = overlay.querySelector('.csv-page-status');
    const mobileResults = overlay.querySelector('.csv-mobile-results');
    let currentPage = 1;
    let previousTerm = '';
    const valuesFor = row => {
      const values = data.headers.map((_, i) => row[i]);
      if (modalityIndex < 0) { const catPos = data.headers.findIndex(h => /categoria/i.test(h)); values.splice(catPos < 0 ? 0 : catPos, 0, distance); }
      return values;
    };
    const update = () => {
      const term = normalize(search.value.trim());
      if (term !== previousTerm) { currentPage = 1; previousTerm = term; }
      const exactNumber = /^\d+$/.test(term);
      const rows = data.rows.filter(row => !term || (exactNumber && numberColumn >= 0 ? normalize(row[numberColumn]).trim() === term : searchable.some(i => normalize(row[i]).includes(term))));
      const pageSize = window.matchMedia('(max-width:650px)').matches ? 25 : 100;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      currentPage = Math.min(currentPage, totalPages);
      const start = (currentPage - 1) * pageSize;
      const visibleRows = rows.slice(start, start + pageSize);
      overlay.querySelector('tbody').innerHTML = visibleRows.map(row => {
        const values = valuesFor(row);
        return '<tr>' + values.map((v, i) => '<td class="' + columnClasses[i] + '">' + escapeHTML(v) + '</td>').join('') + '</tr>';
      }).join('');
      mobileResults.innerHTML = visibleRows.map(row => {
        const values = valuesFor(row);
        return '<article class="csv-mobile-card">' + values.map((v, i) => '<div class="csv-mobile-row"><div class="csv-mobile-label">' + escapeHTML(displayHeaders[i]) + '</div><div class="csv-mobile-value">' + escapeHTML(v || '—') + '</div></div>').join('') + '</article>';
      }).join('');
      const firstShown = rows.length ? start + 1 : 0;
      const lastShown = Math.min(start + pageSize, rows.length);
      overlay.querySelector('.csv-count').textContent = rows.length + (rows.length === 1 ? ' resultado encontrado' : ' resultados encontrados') + (rows.length ? ' · exibindo ' + firstShown + '–' + lastShown : '');
      pageStatus.textContent = 'Página ' + currentPage + ' de ' + totalPages;
      previous.disabled = currentPage === 1;
      next.disabled = currentPage === totalPages;
      pagination.hidden = rows.length <= pageSize;
    };
    previous.addEventListener('click', () => { if (currentPage > 1) { currentPage--; update(); overlay.querySelector('.csv-count').scrollIntoView({block:'nearest'}); } });
    next.addEventListener('click', () => { currentPage++; update(); overlay.querySelector('.csv-count').scrollIntoView({block:'nearest'}); });
    search.addEventListener('input', update);
    window.addEventListener('resize', update, {passive:true});
    update(); search.focus();
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
    const linkFor = (result, index) => '<a class="race-link ' + (result.file.toLowerCase().endsWith('.csv') ? 'csv-result' : '') + '" href="' + result.file + '" data-index="' + index + '" target="_blank" rel="noopener">' + (result.file.toLowerCase().endsWith('.csv') ? '' : '') + ' · ' + [result.sport, result.distance, result.file.toLowerCase().endsWith('.csv') ? 'VER RESULTADO' : result.category, result.sex].filter(Boolean).join(' · ') + ' →</a>';
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
