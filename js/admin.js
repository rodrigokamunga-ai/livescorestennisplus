const form = document.getElementById('matchForm');
const tbody = document.getElementById('matchesTable');
const msg = document.getElementById('adminMsg');
const dialog = document.getElementById('detailsDialog');
const detailsContent = document.getElementById('detailsContent');

const docId = document.getElementById('docId');
const categoryName = document.getElementById('categoryName');
const matchFormat = document.getElementById('matchFormat');
const matchDateTime = document.getElementById('matchDateTime');
const court = document.getElementById('court');
const tournamentStage = document.getElementById('tournamentStage');
const player1 = document.getElementById('player1');
const player2 = document.getElementById('player2');
const winnerByWO = document.getElementById('winnerByWO');
const status = document.getElementById('status');
const formTitle = document.getElementById('formTitle');

const logoutBtn = document.getElementById('logoutBtn');
const newMatchBtn = document.getElementById('newMatchBtn');
const clearBtn = document.getElementById('clearBtn');
const closeDialogBtn = document.getElementById('closeDialogBtn');

const filterPlayers = document.getElementById('filterPlayers');
const filterCategory = document.getElementById('filterCategory');
const filterStatus = document.getElementById('filterStatus');

const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const totalPagesEl = document.getElementById('totalPages');

const ADMIN_KEY = 'lsts_admin_session';
const PAGE_SIZE = 8;

let allMatches = [];
let filteredMatches = [];
let currentPage = 1;

function setMsg(text) {
  if (msg) msg.textContent = text || '';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function statusLabel(statusValue) {
  const s = String(statusValue || '').trim().toLowerCase();
  if (s === 'live') return 'Em andamento';
  if (s === 'finished') return 'Finalizada';
  if (s === 'wo') return 'WO';
  return 'Jogos do dia';
}

function normalizeText(v) {
  return String(v || '').trim();
}

function normalizeMatchFormat(value) {
  const raw = normalizeText(value);

  const map = {
    '3 sets com vantagem': '3 sets com vantagem',
    '3 sets sem vantagem': '3 sets sem vantagem',

    '2 sets com vantagem + o 3º set um supertiebreak de 10 pontos': '2 sets com vantagem + o 3º set um supertiebreak de 10 pontos',
    '2 sets sem vantagem + o 3º set um supertiebreak de 10 pontos': '2 sets sem vantagem + o 3º set um supertiebreak de 10 pontos',

    '1 set com vantagem com supertiebreak de 10 pontos': '1 set com vantagem com supertiebreak de 10 pontos',
    '1 set sem vantagem com um supertiebreak de 10 pontos': '1 set sem vantagem com um supertiebreak de 10 pontos',

    '1 set com vantagem com um tiebreak de 7 pontos': '1 set com vantagem com um tiebreak de 7 pontos',
    '1 set sem vantagem com um tiebreak de 7 pontos': '1 set sem vantagem com um tiebreak de 7 pontos',

    '1 set pro de 8 games com vantagem com um tiebreak de 7 pontos': '1 set pro de 8 games com vantagem com um tiebreak de 7 pontos',
    '1 set pro de 8 games sem vantagem com um tiebreak de 7 pontos': '1 set pro de 8 games sem vantagem com um tiebreak de 7 pontos',
    '1 set pro de 8 games sem vantagem com um supertiebreak de 10 pontos': '1 set pro de 8 games sem vantagem com um supertiebreak de 10 pontos',

    '2 sets de 4 games sem vantagem com um supertiebreak de 10 pontos': '2 sets de 4 games sem vantagem com um supertiebreak de 10 pontos',
    '2 sets de 4 games com vantagem com um supertiebreak de 10 pontos': '2 sets de 4 games com vantagem com um supertiebreak de 10 pontos'
  };

  return map[raw] || raw;
}

function resolveTieBreakMode(matchFormatValue) {
  const text = String(matchFormatValue || "").toLowerCase().trim();

  if (/tiebreak de 7 pontos\b/.test(text)) return "tb7";
  if (/supertiebreak de 10 pontos\b/.test(text)) return "super10";

  return null;
}

function defaultScore() {
  return {
    points1: 0,
    points2: 0,
    games1: 0,
    games2: 0,
    sets1: 0,
    sets2: 0,
    tieBreakMode: null,
    tieBreakPoints1: 0,
    tieBreakPoints2: 0,
    setHistory: [],
    server: 'player1'
  };
}

function normalizeScore(score = {}) {
  return {
    ...defaultScore(),
    ...score,
    setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
    tieBreakMode: score.tieBreakMode === 'tb7' || score.tieBreakMode === 'super10'
      ? score.tieBreakMode
      : null,
    server: score.server || 'player1'
  };
}

function buildScoreForSave(matchFormatValue, scoreData = {}) {
  const score = normalizeScore(scoreData);

  return {
    ...score,
    points1: Number(score.points1 || 0),
    points2: Number(score.points2 || 0),
    games1: Number(score.games1 || 0),
    games2: Number(score.games2 || 0),
    sets1: Number(score.sets1 || 0),
    sets2: Number(score.sets2 || 0),
    tieBreakMode: score.tieBreakMode || resolveTieBreakMode(matchFormatValue) || null,
    tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
    tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
    setHistory: Array.isArray(score.setHistory) ? score.setHistory : []
  };
}

function clearForm() {
  if (form) form.reset();
  if (docId) docId.value = '';
  if (status) status.value = 'scheduled';
  if (winnerByWO) winnerByWO.value = '';
  if (formTitle) formTitle.textContent = 'Nova partida';
  setMsg('');
}

function fillForm(data, id) {
  if (docId) docId.value = id || '';
  if (categoryName) categoryName.value = data?.categoryName || '';
  if (matchFormat) matchFormat.value = normalizeMatchFormat(data?.matchFormat || '');
  if (matchDateTime) matchDateTime.value = data?.matchDateTime || '';
  if (court) court.value = data?.court || '';
  if (tournamentStage) tournamentStage.value = data?.tournamentStage || '';
  if (player1) player1.value = data?.player1 || '';
  if (player2) player2.value = data?.player2 || '';
  if (winnerByWO) winnerByWO.value = data?.winnerByWO || '';
  if (status) status.value = data?.status || 'scheduled';
  if (formTitle) formTitle.textContent = id ? 'Editando partida' : 'Nova partida';
}

function buildPublicLink(id) {
  return `${location.origin}${location.pathname.replace('admin.html', 'player.html')}?id=${id}`;
}

function formatDateTimeDisplay(value) {
  if (!value) return '-';

  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('pt-BR');
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleString('pt-BR');
  return value;
}

function detailsHTML(d, id) {
  const link = buildPublicLink(id);

  return ` <div><strong>Categoria:</strong> ${d.categoryName || '-'}</div> <div><strong>Formato:</strong> ${normalizeMatchFormat(d.matchFormat || '-')}</div> <div><strong>Data e hora do jogo:</strong> ${formatDateTimeDisplay(d.matchDateTime)}</div> <div><strong>Quadra:</strong> ${d.court || '-'}</div> <div><strong>Fase:</strong> ${d.tournamentStage || '-'}</div> <div><strong>Jogador 1:</strong> ${d.player1 || '-'}</div> <div><strong>Jogador 2:</strong> ${d.player2 || '-'}</div> <div><strong>Status:</strong> ${statusLabel(d.status)}</div> <div><strong>WO:</strong> ${d.winnerByWO || 'Nenhum'}</div> <div><strong>Link da partida:</strong> <a href="${link}" target="_blank" rel="noreferrer">${link}</a></div> `;
}

function rowHTML(docSnap) {
  const d = docSnap.data();

  return ` <tr> <td> <div class="players-cell"> <strong>${d.player1 || 'Jogador 1'}</strong> <span>vs</span> <strong>${d.player2 || 'Jogador 2'}</strong> </div> </td> <td title="${d.categoryName || '-'}">${d.categoryName || '-'}</td> <td><span class="status-tag status-${normalizeStatus(d.status)}">${statusLabel(d.status)}</span></td> <td> <div class="action-icons"> <button class="icon-btn" data-action="copy" data-id="${docSnap.id}" title="Copiar link" aria-label="Copiar link">🔗</button> <button class="icon-btn" data-action="detail" data-id="${docSnap.id}" title="Detalhar" aria-label="Detalhar">👁️</button> <button class="icon-btn" data-action="edit" data-id="${docSnap.id}" title="Editar" aria-label="Editar">✏️</button> <button class="icon-btn danger" data-action="delete" data-id="${docSnap.id}" title="Excluir" aria-label="Excluir">🗑️</button> </div> </td> </tr> `;
}

function goLogin() {
  window.location.replace('login.html');
}

function sortLocalMatches() {
  allMatches.sort((a, b) => {
    const da = a.data?.matchDateTime;
    const db = b.data?.matchDateTime;

    const ta = da?.toDate ? da.toDate().getTime() : new Date(da || 0).getTime();
    const tb = db?.toDate ? db.toDate().getTime() : new Date(db || 0).getTime();

    return ta - tb;
  });
}

function applyFilters() {
  const p = filterPlayers.value.trim().toLowerCase();
  const c = filterCategory.value.trim().toLowerCase();
  const s = filterStatus.value.trim().toLowerCase();

  filteredMatches = allMatches.filter(({ data }) => {
    const playerText = `${data.player1 || ''} ${data.player2 || ''}`.toLowerCase();
    const categoryText = `${data.categoryName || ''}`.toLowerCase();
    const statusText = normalizeStatus(data.status);

    const okPlayers = !p || playerText.includes(p);
    const okCategory = !c || categoryText.includes(c);
    const okStatus = !s || statusText === s;

    return okPlayers && okCategory && okStatus;
  });

  currentPage = 1;
  renderPagination();
  renderCurrentPage();
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  if (pageInfo) pageInfo.textContent = String(currentPage);
  if (totalPagesEl) totalPagesEl.textContent = String(totalPages);

  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
}

function renderCurrentPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredMatches.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems.length
    ? pageItems.map(({ docSnap }) => rowHTML(docSnap)).join('')
    : `<tr><td colspan="4" class="empty-card">Nenhuma partida encontrada.</td></tr>`;
}

function refreshList() {
  sortLocalMatches();
  applyFilters();
}

const session = localStorage.getItem(ADMIN_KEY);
if (session !== '1') {
  goLogin();
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      localStorage.removeItem(ADMIN_KEY);
      await __auth.signOut();
      goLogin();
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

if (newMatchBtn) newMatchBtn.addEventListener('click', clearForm);
if (clearBtn) clearBtn.addEventListener('click', clearForm);
if (closeDialogBtn) closeDialogBtn.addEventListener('click', () => dialog.close());

if (filterPlayers) filterPlayers.addEventListener('input', applyFilters);
if (filterCategory) filterCategory.addEventListener('input', applyFilters);
if (filterStatus) filterStatus.addEventListener('change', applyFilters);

if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPagination();
      renderCurrentPage();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredMatches.length / PAGE_SIZE));
    if (currentPage < totalPages) {
      currentPage++;
      renderPagination();
      renderCurrentPage();
    }
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('Salvando...');

    const selectedFormat = normalizeMatchFormat(matchFormat ? matchFormat.value : '');
    const tieBreakMode = resolveTieBreakMode(selectedFormat);

    const data = {
      categoryName: categoryName ? categoryName.value.trim() : '',
      matchFormat: selectedFormat,
      matchDateTime: matchDateTime ? matchDateTime.value : '',
      court: court ? court.value.trim() : '',
      tournamentStage: tournamentStage ? tournamentStage.value : '',
      player1: player1 ? player1.value.trim() : '',
      player2: player2 ? player2.value.trim() : '',
      winnerByWO: winnerByWO ? winnerByWO.value : '',
      status: status ? status.value : 'scheduled',
      score: buildScoreForSave(selectedFormat, { tieBreakMode }),
      durationSeconds: 0,
      startedAt: null,
      finishedAt: null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      if (docId && docId.value) {
        await __db.collection('matches').doc(docId.value).update(data);
        setMsg('Partida atualizada.');
      } else {
        await __db.collection('matches').add({
          ...data,
          matchId: `JOGO-${Date.now().toString().slice(-6)}`,
          publicLinkId: crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()).slice(-8),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setMsg('Partida criada.');
      }

      clearForm();
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

if (tbody) {
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ref = __db.collection('matches').doc(id);

    try {
      if (action === 'delete') {
        if (confirm('Excluir esta partida?')) {
          await ref.delete();
          setMsg('Partida excluída.');
        }
      }

      if (action === 'edit') {
        const snap = await ref.get();
        if (snap.exists) fillForm(snap.data(), id);
      }

      if (action === 'detail') {
        const snap = await ref.get();
        if (snap.exists) {
          detailsContent.innerHTML = detailsHTML(snap.data(), id);
          dialog.showModal();
        }
      }

      if (action === 'copy') {
        const link = buildPublicLink(id);
        await navigator.clipboard.writeText(link);
        setMsg('Link copiado.');
      }
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
}

__db.collection('matches').onSnapshot(
  (snap) => {
    allMatches = snap.docs.map((docSnap) => ({
      docSnap,
      data: docSnap.data()
    }));

    refreshList();
  },
  (err) => {
    console.error(err);
    setMsg(err.message);
  }
);