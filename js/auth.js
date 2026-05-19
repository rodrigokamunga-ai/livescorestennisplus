const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");

const REDIRECT_URL = "menu.html";
const SESSION_KEY = "lsts_admin_session";
const REMEMBER_EMAIL_KEY = "rememberedEmail";

const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
if (savedEmail && emailInput && rememberMe) {
  emailInput.value = savedEmail;
  rememberMe.checked = true;
}

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function goHome() {
  window.location.replace(REDIRECT_URL);
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, "1");
}

__auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    __auth.onAuthStateChanged((user) => {
      if (user) {
        saveSession();
        goHome();
      }
    });
  })
  .catch((err) => {
    console.error(err);
    setMsg("Erro ao configurar login.");
  });

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Entrando...");

  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  try {
    await __auth.signInWithEmailAndPassword(email, password);

    if (rememberMe?.checked) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    saveSession();
    goHome();
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});