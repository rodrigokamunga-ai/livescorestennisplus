const scheduledList = document.getElementById('scheduledList');
const liveList = document.getElementById('liveList');
const finishedList = document.getElementById('finishedList');

const scheduledCount = document.getElementById('scheduledCount');
const liveCount = document.getElementById('liveCount');
const finishedCount = document.getElementById('finishedCount');

const badge = document.getElementById('connectionBadge');

function formatDateTime(value) {
  if (!value) return null;

  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateBR(dateObj) {
  if (!dateObj) return '--/--';
  return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatTimeBR(dateObj) {
  if (!dateObj) return '--:--';
  return dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function durationText(seconds = 0) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function mapStatus(status) {
  if (status === 'live') return 'EM ANDAMENTO';
  if (status === 'finished') return 'FINALIZADA';
  if (status === 'wo') return 'WO';
  return 'NÃO INICIADA';
}

function statusClass(status) {
  if (status === 'live') return 'status-live';
  if (status === 'finished') return 'status-finished';
  if (status === 'wo') return 'status-wo';
  return 'status-scheduled';
}

function renderCompactCard(docSnap) {
  const d = docSnap.data();
  const score = d.score || {};
  const dt = formatDateTime(d.matchDateTime);

  return ` <article class="match-mini-card ${statusClass(d.status)}"> <div class="mini-card-top"> <span class="mini-category">${d.categoryName || 'Categoria'}</span> <span class="mini-status">${mapStatus(d.status)}</span> </div> <div class="mini-teams"> <div class="mini-player">${d.player1 || 'Jogador 1'}</div> <div class="mini-vs">${score.player1 ?? 0} x ${score.player2 ?? 0}</div> <div class="mini-player">${d.player2 || 'Jogador 2'}</div> </div> <div class="mini-meta"> <span>${formatDateBR(dt)}</span> <span>${formatTimeBR(dt)}</span> <span>${durationText(d.durationSeconds || 0)}</span> </div> </article> `;
}

function renderList(listEl, docs) {
  listEl.innerHTML = docs.length
    ? docs.map(renderCompactCard).join('')
    : '<div class="card empty-card"><small>Nenhuma partida.</small></div>';
}

function updateCounts(scheduled, live, finished) {
  if (scheduledCount) scheduledCount.textContent = scheduled.length;
  if (liveCount) liveCount.textContent = live.length;
  if (finishedCount) finishedCount.textContent = finished.length;
}

function sortByDateTime(a, b) {
  const da = formatDateTime(a.data()?.matchDateTime);
  const db = formatDateTime(b.data()?.matchDateTime);

  const ta = da ? da.getTime() : 0;
  const tb = db ? db.getTime() : 0;

  return ta - tb;
}

__db.collection('matches')
  .orderBy('matchDateTime', 'asc')
  .onSnapshot((snap) => {
    const scheduled = [];
    const live = [];
    const finished = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();

      if (d.status === 'live') {
        live.push(docSnap);
      } else if (d.status === 'finished' || d.status === 'wo') {
        finished.push(docSnap);
      } else {
        scheduled.push(docSnap);
      }
    });

    // ordenação adicional no front para manter tudo consistente
    scheduled.sort(sortByDateTime);
    live.sort(sortByDateTime);
    finished.sort(sortByDateTime);

    renderList(scheduledList, scheduled);
    renderList(liveList, live);
    renderList(finishedList, finished);
    updateCounts(scheduled, live, finished);

    if (badge) {
      badge.textContent = `Atualizado: ${new Date().toLocaleTimeString()}`;
    }
  }, (err) => {
    console.error(err);
    if (badge) {
      badge.textContent = 'Erro de conexão';
    }
  });