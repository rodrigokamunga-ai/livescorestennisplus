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

const ADMIN_KEY = 'lsts_admin_session';

function setMsg(text) {
  msg.textContent = text || '';
}

function clearForm() {
  form.reset();
  docId.value = '';
  status.value = 'scheduled';
  formTitle.textContent = 'Nova partida';
}

function fillForm(data, id) {
  docId.value = id || '';
  categoryName.value = data?.categoryName || '';
  matchFormat.value = data?.matchFormat || '';
  matchDateTime.value = data?.matchDateTime || '';
  court.value = data?.court || '';
  tournamentStage.value = data?.tournamentStage || '';
  player1.value = data?.player1 || '';
  player2.value = data?.player2 || '';
  winnerByWO.value = data?.winnerByWO || '';
  status.value = data?.status || 'scheduled';
  formTitle.textContent = id ? `Editando #${data.matchId || id}` : 'Nova partida';
}

function buildPublicLink(id) {
  return `${location.origin}${location.pathname.replace('admin.html', 'player.html')}?id=${id}`;
}

function formatDateTimeDisplay(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR');
}

function detailsHTML(d, id) {
  const link = buildPublicLink(id);
  return `
    <div><strong>Categoria:</strong> ${d.categoryName || '-'}</div>
    <div><strong>Formato:</strong> ${d.matchFormat || '-'}</div>
    <div><strong>Data e hora do jogo:</strong> ${formatDateTimeDisplay(d.matchDateTime)}</div>
    <div><strong>Quadra:</strong> ${d.court || '-'}</div>
    <div><strong>Fase:</strong> ${d.tournamentStage || '-'}</div>
    <div><strong>Jogador 1:</strong> ${d.player1 || '-'}</div>
    <div><strong>Jogador 2:</strong> ${d.player2 || '-'}</div>
    <div><strong>Link da partida:</strong> <a href="${link}" target="_blank">${link}</a></div>
    <div><strong>WO:</strong> ${d.winnerByWO || 'Nenhum'}</div>
  `;
}

function rowHTML(docSnap) {
  const d = docSnap.data();
  return `
    <tr>
      <td>#${d.matchId || docSnap.id}</td>
      <td>${d.categoryName || '-'}</td>
      <td>${d.status || '-'}</td>
      <td>
        <button class="btn" data-action="copy" data-id="${docSnap.id}">Copiar link</button>
        <button class="btn" data-action="detail" data-id="${docSnap.id}">Detalhar</button>
        <button class="btn" data-action="edit" data-id="${docSnap.id}">Editar</button>
        <button class="btn danger" data-action="delete" data-id="${docSnap.id}">Excluir</button>
      </td>
    </tr>
  `;
}

function goLogin() {
  window.location.replace('login.html');
}

const session = localStorage.getItem(ADMIN_KEY);
if (session !== '1') {
  goLogin();
}

__auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
  console.error(err);
});

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

newMatchBtn.addEventListener('click', clearForm);
clearBtn.addEventListener('click', clearForm);
closeDialogBtn.addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('Salvando...');

  const data = {
    categoryName: categoryName.value.trim(),
    matchFormat: matchFormat.value.trim(),
    matchDateTime: matchDateTime.value,
    court: court.value.trim(),
    tournamentStage: tournamentStage.value.trim(),
    player1: player1.value.trim(),
    player2: player2.value.trim(),
    winnerByWO: winnerByWO.value,
    status: status.value,
    score: { player1: 0, player2: 0 },
    durationSeconds: 0,
    startedAt: null,
    finishedAt: null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (docId.value) {
      await __db.collection('matches').doc(docId.value).update(data);
      setMsg('Partida atualizada.');
    } else {
      const ref = await __db.collection('matches').add({
        ...data,
        matchId: `JOGO-${Date.now().toString().slice(-6)}`,
        publicLinkId: crypto.randomUUID().slice(0, 8),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setMsg(`Partida criada: ${ref.id}`);
    }

    clearForm();
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});

__db.collection('matches')
  .orderBy('matchDateTime', 'asc')
  .onSnapshot((snap) => {
    tbody.innerHTML = snap.docs.map(rowHTML).join('');
  }, (err) => {
    console.error(err);
    setMsg(err.message);
  });

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
