const form = document.getElementById('loginForm');
const msg = document.getElementById('loginMsg');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberMe = document.getElementById('rememberMe');

const savedEmail = localStorage.getItem('rememberedEmail');
if (savedEmail) {
  emailInput.value = savedEmail;
  rememberMe.checked = true;
}

function setMsg(text) {
  msg.textContent = text || '';
}

__auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    __auth.onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('lsts_admin_session', '1');
        window.location.replace('admin.html');
      }
    });
  })
  .catch((err) => {
    console.error(err);
    setMsg('Erro ao configurar login.');
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
    window.location.replace('admin.html');
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});