const state = { races: [] };
const el = {
  search: document.querySelector('#search'),
  year: document.querySelector('#year-filter'),
  sport: document.querySelector('#sport-filter'),
  list: document.querySelector('#race-list'),
  count: document.querySelector('#result-count'),
  empty: document.querySelector('#empty-state'),
  clear: document.querySelector('#clear-filters')
};

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function render() {
  const term = normalize(el.search.value);
  const year = el.year.value;
  const sport = el.sport.value;
  const filtered = state.races.filter(race => {
    const haystack = normalize(`${race.name} ${race.city} ${race.state} ${race.year}`);
    return (!term || haystack.includes(term)) && (!year || String(race.year) === year) && (!sport || race.sport === sport);
  });
  el.count.textContent = `${filtered.length} ${filtered.length === 1 ? 'prova encontrada' : 'provas encontradas'}`;
  el.empty.hidden = filtered.length > 0;
  el.list.innerHTML = filtered.map(race => `
    <article class="race-card" data-format="${race.format}">
      <span class="race-year">${race.year}</span>
      <h3>${race.name}</h3>
      <p class="race-location">${race.city} · ${race.state}</p>
      <div class="race-tags"><span class="tag">${race.sport}</span><span class="tag">${race.format}</span></div>
      ${race.file ? `<a class="race-link" href="${race.file}">${race.format === 'CSV' ? 'Consultar atletas →' : 'Abrir resultado →'}</a>` : '<span class="race-link" aria-disabled="true">Resultado em preparação</span>'}
    </article>`).join('');
}

async function loadRaces() {
  try {
    const response = await fetch('data/provas.json');
    if (!response.ok) throw new Error('Falha ao carregar');
    state.races = await response.json();
    [...new Set(state.races.map(r => r.year))].sort((a,b) => b-a).forEach(year => el.year.insertAdjacentHTML('beforeend', `<option value="${year}">${year}</option>`));
    render();
  } catch {
    el.count.textContent = 'Os resultados não puderam ser carregados.';
    el.empty.hidden = false;
  }
}

[el.search, el.year, el.sport].forEach(input => input.addEventListener('input', render));
el.clear.addEventListener('click', () => { el.search.value = ''; el.year.value = ''; el.sport.value = ''; render(); el.search.focus(); });
document.querySelector('#current-year').textContent = new Date().getFullYear();
loadRaces();
