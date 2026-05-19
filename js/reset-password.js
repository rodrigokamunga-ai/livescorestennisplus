const form = document.getElementById("resetPasswordForm");
const msg = document.getElementById("resetPasswordMsg");
const emailInput = document.getElementById("email");

const RESET_PASSWORD_URL = `${window.location.origin}/reset-password.html`;

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function goLogin() {
  window.location.replace("login.html");
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Enviando link de redefinição...");

  const email = emailInput?.value.trim() || "";

  if (!email) {
    setMsg("Informe o e-mail.");
    return;
  }

  try {
    await __auth.sendPasswordResetEmail(email, {
      url: RESET_PASSWORD_URL
    });

    setMsg("Link de redefinição enviado para o seu e-mail.");

    setTimeout(() => {
      goLogin();
    }, 1800);
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});