const form = document.getElementById("registerForm");
const msg = document.getElementById("registerMsg");
const displayNameInput = document.getElementById("displayName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const SESSION_KEY = "lsts_admin_session";

function setMsg(text) {
  if (msg) msg.textContent = text || "";
}

function goLogin() {
  window.location.replace("login.html");
}

async function saveUserProfile(user, displayName, email) {
  if (!window.__db) return;

  const docRef = __db.collection("users").doc(user.uid);
  await docRef.set({
    uid: user.uid,
    displayName: displayName || user.displayName || "",
    email: email || user.email || "",
    role: "user",
    blocked: false,
    ownerId: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Criando cadastro...");

  const displayName = displayNameInput?.value.trim() || "";
  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";
  const confirmPassword = confirmPasswordInput?.value || "";

  if (!displayName) {
    setMsg("Informe o nome.");
    return;
  }

  if (!email) {
    setMsg("Informe o e-mail.");
    return;
  }

  if (password.length < 6) {
    setMsg("A senha deve ter no mínimo 6 caracteres.");
    return;
  }

  if (password !== confirmPassword) {
    setMsg("As senhas não conferem.");
    return;
  }

  try {
    const credential = await __auth.createUserWithEmailAndPassword(email, password);
    const user = credential.user;

    if (!user) {
      setMsg("Não foi possível criar a conta.");
      return;
    }

    await user.updateProfile({
      displayName
    });

    await saveUserProfile(user, displayName, email);

    localStorage.setItem(SESSION_KEY, "1");
    setMsg("Cadastro criado com sucesso!");

    setTimeout(() => {
      window.location.replace("login.html");
    }, 1200);
  } catch (err) {
    console.error(err);
    setMsg(err.message);
  }
});