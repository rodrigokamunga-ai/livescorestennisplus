const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const matchHeader = document.getElementById('matchHeader');
const matchTitle = document.getElementById('matchTitle');
const matchSubTitle = document.getElementById('matchSubTitle');
const playerStatus = document.getElementById('playerStatus');
const statusLabel = document.getElementById('statusLabel');
const matchInfo = document.getElementById('matchInfo');
const durationEl = document.getElementById('duration');
const msg = document.getElementById('playerMsg');

const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const editScore1 = document.getElementById('editScore1');
const editScore2 = document.getElementById('editScore2');
const startBtn = document.getElementById('startBtn');
const finishBtn = document.getElementById('finishBtn');
const player1Name = document.getElementById('player1Name');
const player2Name = document.getElementById('player2Name');

let timer = null;

function setMsg(text) {
  if (msg) msg.textContent = text || '';
}

function durationText(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function formatDateTime(value) {
  if (!value) return '-';

  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('pt-BR');
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString('pt-BR');
  }

  return value;
}

function mapStatus(status) {
  if (status === 'live') return 'EM ANDAMENTO';
  if (status === 'finished') return 'FINALIZADA';
  if (status === 'wo') return 'FINALIZADA POR WO';
  return 'NÃO INICIADA';
}

function setTimerFromStartedAt(startedAt) {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (!startedAt) return;

  timer = setInterval(() => {
    durationEl.textContent = durationText(Date.now() - startedAt.getTime());
  }, 1000);
}

function renderInfoBoxes(data) {
  const dt = data.matchDateTime;

  matchInfo.innerHTML = `
    <div class="player-info-item">
      <span>Categoria</span>
      <strong>${data.categoryName || '-'}</strong>
    </div>

    <div class="player-info-item">
      <span>Formato</span>
      <strong>${data.matchFormat || '-'}</strong>
    </div>

    <div class="player-info-item">
      <span>Data e hora</span>
      <strong>${formatDateTime(dt)}</strong>
    </div>

    <div class="player-info-item">
      <span>Quadra</span>
      <strong>${data.court || '-'}</strong>
    </div>

    <div class="player-info-item">
      <span>Fase</span>
      <strong>${data.tournamentStage || '-'}</strong>
    </div>

    <div class="player-info-item">
      <span>Status</span>
      <strong>${mapStatus(data.status)}</strong>
    </div>
  `;
}

function render(data) {
  const dt = data.matchDateTime;

  player1Name.textContent = data.player1 || 'Jogador 1';
  player2Name.textContent = data.player2 || 'Jogador 2';

  score1.textContent = data.score?.player1 ?? 0;
  score2.textContent = data.score?.player2 ?? 0;
  editScore1.value = data.score?.player1 ?? 0;
  editScore2.value = data.score?.player2 ?? 0;

  matchHeader.textContent = `${data.categoryName || '-'} • ${formatDateTime(dt)}`;
  matchTitle.textContent = `${data.player1 || 'Jogador 1'} x ${data.player2 || 'Jogador 2'}`;
  matchSubTitle.textContent = `Categoria: ${data.categoryName || '-'} | Fase: ${data.tournamentStage || '-'} | Quadra: ${data.court || '-'}`;

  playerStatus.textContent = mapStatus(data.status);
  statusLabel.textContent = mapStatus(data.status);

  durationEl.textContent = durationText((data.durationSeconds || 0) * 1000);

  startBtn.disabled = data.status === 'live';
  finishBtn.disabled = data.status !== 'live';

  renderInfoBoxes(data);

  if (data.status === 'live' && data.startedAt && data.startedAt.toDate) {
    setTimerFromStartedAt(data.startedAt.toDate());
  } else {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
}

function loadMatch() {
  if (!id) {
    setMsg('ID da partida não informado.');
    return;
  }

  __db.collection('matches').doc(id).onSnapshot((snap) => {
    if (!snap.exists) {
      setMsg('Partida não encontrada.');
      return;
    }

    render(snap.data());
  }, (err) => {
    console.error(err);
    setMsg(err.message);
  });
}

startBtn.addEventListener('click', async () => {
  if (!id) return;

  try {
    await __db.collection('matches').doc(id).update({
      status: 'live',
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setMsg('Partida iniciada.');
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});

finishBtn.addEventListener('click', async () => {
  if (!id) return;

  try {
    const ref = __db.collection('matches').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      setMsg('Partida não encontrada.');
      return;
    }

    const data = snap.data();

    await ref.update({
      status: data.winnerByWO ? 'wo' : 'finished',
      finishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setMsg('Partida finalizada.');
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});

document.querySelectorAll('[data-delta]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!id) return;

    const target = btn.dataset.target;
    const delta = Number(btn.dataset.delta);

    try {
      await __db.collection('matches').doc(id).update({
        [`score.${target}`]: firebase.firestore.FieldValue.increment(delta),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
});

document.querySelectorAll('[data-save]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!id) return;

    const target = btn.dataset.save;
    const value = Number(target === 'player1' ? editScore1.value : editScore2.value);

    try {
      await __db.collection('matches').doc(id).update({
        [`score.${target}`]: value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  });
});

loadMatch();
