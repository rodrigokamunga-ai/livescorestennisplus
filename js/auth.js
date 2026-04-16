const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMsg');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMe = document.getElementById('rememberMe');

function setMsg(text) {
  msg.textContent = text || '';
}

function goAdmin() {
  window.location.replace('admin.html');
}

const savedEmail = localStorage.getItem('rememberedEmail');
if (savedEmail) {
  emailInput.value = savedEmail;
  rememberMe.checked = true;
}

__auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    __auth.onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('lsts_admin_session', '1');
        goAdmin();
      }
    });
  })
  .catch((err) => {
    console.error(err);
    setMsg('Erro ao configurar persistência de login.');
  });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('Entrando...');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    await __auth.signInWithEmailAndPassword(email, password);

    if (rememberMe.checked) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    localStorage.setItem('lsts_admin_session', '1');
    goAdmin();
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});
