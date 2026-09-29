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

function render() {
  const term = normalize(el.search.value);
  const year = el.year.value;
  const sport = el.sport.value;
  const filtered = state.races.filter(race => {
    const resultTerms = (race.results || []).map(result => `${result.distance} ${result.category} ${result.sex}`).join(' ');
    const haystack = normalize(`${race.name} ${race.city} ${race.state} ${race.year} ${race.sport} ${resultTerms}`);
    return (!term || haystack.includes(term)) && (!year || String(race.year) === year) && (!sport || race.sport === sport);
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
      ${(race.results || []).length === 1 ? `<a class="race-link" href="${race.results[0].file}" target="_blank" rel="noopener">${[race.results[0].distance, race.results[0].category, race.results[0].sex].filter(Boolean).join(' · ')} →</a>` : (race.results || []).length > 1 ? `<details class="race-results"><summary>Ver ${race.results.length} resultados</summary><div class="race-links">${race.results.map(result => `<a class="race-link" href="${result.file}" target="_blank" rel="noopener">${[result.distance, result.category, result.sex].filter(Boolean).join(' · ')} →</a>`).join('')}</div></details>` : race.file ? `<a class="race-link" href="${race.file}">${race.format === 'CSV' ? 'Consultar atletas →' : 'Abrir resultado →'}</a>` : '<span class="race-link" aria-disabled="true">Resultado em preparação</span>'}
    </article>`).join('');
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
