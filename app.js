const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const searchForm = document.getElementById('search-form');
const qInput = document.getElementById('q');
const langInput = document.getElementById('lang');
const starsInput = document.getElementById('stars');
const tokenInput = document.getElementById('token');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const clearBtn = document.getElementById('clear-btn');

let currentPage = 1;
const perPage = 10;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  currentPage = 1;
  await doSearch();
});

clearBtn.addEventListener('click', () => {
  qInput.value = '';
  langInput.value = '';
  starsInput.value = 0;
  tokenInput.value = '';
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Cleared.';
  prevBtn.disabled = true;
  nextBtn.disabled = true;
});

prevBtn.addEventListener('click', async () => {
  if (currentPage > 1) {
    currentPage--;
    await doSearch();
  }
});

nextBtn.addEventListener('click', async () => {
  currentPage++;
  await doSearch();
});

function buildQuery() {
  const parts = [];
  const kw = qInput.value.trim();
  if (kw) parts.push(kw);
  const lang = langInput.value.trim();
  if (lang) parts.push(`language:${lang}`);
  const stars = parseInt(starsInput.value || '0', 10);
  if (stars > 0) parts.push(`stars:>=${stars}`);
  const qstr = parts.join(' ');
  return encodeURIComponent(qstr || 'stars:>0');
}

async function doSearch() {
  const q = buildQuery();
  const url = `https://api.github.com/search/repositories?q=${q}&sort=best-match&order=desc&per_page=${perPage}&page=${currentPage}`;
  
  statusEl.textContent = `Searching… (page ${currentPage})`;
  resultsEl.innerHTML = '';

  try {
    const headers = {};
    const token = tokenInput.value.trim();
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      statusEl.textContent = `GitHub error: ${res.status} — ${res.statusText}`;
      console.error('GitHub error details:', errText);
      return;
    }
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error('Network or fetch error:', err);
    statusEl.textContent = 'Network error, check console.';
  }
}

function renderResults(data) {
  if (!data || !data.items || data.items.length === 0) {
    statusEl.textContent = 'No results found.';
    prevBtn.disabled = (currentPage <= 1);
    nextBtn.disabled = true;
    return;
  }

  statusEl.textContent = `Showing ${data.items.length} results (approx ${data.total_count})`;
  resultsEl.innerHTML = '';
  data.items.forEach(repo => {
    resultsEl.appendChild(createRepoCard(repo));
  });

  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (data.items.length < perPage);
}

function createRepoCard(repo) {
  const col = document.createElement('div');
  col.className = 'col-12 col-md-6 col-lg-4';

  const card = document.createElement('div');
  card.className = 'card h-100 shadow-sm';

  const body = document.createElement('div');
  body.className = 'card-body d-flex flex-column';

  // Title + link
  const title = document.createElement('h5');
  title.className = 'card-title';
  title.innerHTML = `<a href="${repo.html_url}" target="_blank">${repo.full_name}</a>`;

  // Description
  const desc = document.createElement('p');
  desc.className = 'card-text';
  desc.textContent = repo.description || '—';

  // Stats row
  const statsRow = document.createElement('div');
  statsRow.className = 'd-flex flex-wrap gap-2 align-items-center mb-2';
  statsRow.innerHTML = `
    <span class="badge bg-secondary">★ ${repo.stargazers_count}</span>
    <span class="badge bg-secondary">🍴 ${repo.forks_count}</span>
    <span class="badge bg-light text-dark">Issues: ${repo.open_issues_count}</span>
    <span class="small-muted ms-2">Last push: ${formatDate(repo.pushed_at)}</span>
  `;

  // Health
  const health = computeHealth(repo);
  const healthRow = document.createElement('div');
  healthRow.className = 'mb-2';
  healthRow.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <div>Health:</div>
      <div class="progress flex-grow-1" style="height: 10px;">
        <div class="progress-bar" role="progressbar" style="width: ${health.score}%;"></div>
      </div>
      <div class="ms-2 small-muted">${health.label}</div>
    </div>
  `;

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'mt-auto d-flex gap-2';
  const gfiBtn = document.createElement('button');
  gfiBtn.className = 'btn btn-sm btn-outline-primary';
  gfiBtn.textContent = 'Check good first issues';
  gfiBtn.onclick = async () => {
    gfiBtn.disabled = true;
    gfiBtn.textContent = 'Checking…';
    const count = await fetchGoodFirstIssues(repo.full_name);
    gfiBtn.textContent = `Good first issues: ${count}`;
    gfiBtn.disabled = false;
  };

  const openIssuesLink = document.createElement('a');
  openIssuesLink.className = 'btn btn-sm btn-outline-secondary';
  openIssuesLink.href = `${repo.html_url}/issues`;
  openIssuesLink.target = '_blank';
  openIssuesLink.textContent = 'View issues';

  actions.appendChild(gfiBtn);
  actions.appendChild(openIssuesLink);

  // Assemble card
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(statsRow);
  body.appendChild(healthRow);
  body.appendChild(actions);
  card.appendChild(body);
  col.appendChild(card);
  return col;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function computeHealth(repo) {
  const stars = repo.stargazers_count || 0;
  let score = Math.min(70, Math.round(stars / 10));
  if (repo.pushed_at) {
    const pushed = new Date(repo.pushed_at);
    const now = new Date();
    const diffDays = Math.round((now - pushed) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      score += 20;
      return { score: Math.min(score, 100), label: 'Active' };
    } else if (diffDays <= 180) {
      score += 10;
      return { score: Math.min(score, 100), label: 'Maintained' };
    }
  }
  return { score: Math.max(score, 5), label: 'Stale' };
}

async function fetchGoodFirstIssues(fullName) {
  try {
    const token = tokenInput.value.trim();
    const headers = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    const q = encodeURIComponent(`repo:${fullName} label:"good first issue" state:open`);
    const url = `https://api.github.com/search/issues?q=${q}&per_page=1`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('GFI fetch failed', res.status, await res.text());
      return 'error';
    }
    const data = await res.json();
    return data.total_count || 0;
  } catch (err) {
    console.error('Error in fetchGoodFirstIssues:', err);
    return 'err';
  }
} 
