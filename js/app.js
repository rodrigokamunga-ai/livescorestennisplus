const statusEl = document.getElementById("status");
const btnTeste = document.getElementById("btnTeste");
const btnInstalar = document.getElementById("btnInstalar");

let deferredPrompt = null;

btnTeste.addEventListener("click", () => {
  statusEl.textContent = "Status: botão funcionando!";
  alert("Seu PWA está funcionando!");
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstalar.hidden = false;
  statusEl.textContent = "Status: PWA pronto para instalar.";
});

btnInstalar.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;

  if (choiceResult.outcome === "accepted") {
    statusEl.textContent = "Status: instalação aceita pelo usuário.";
  } else {
    statusEl.textContent = "Status: instalação recusada pelo usuário.";
  }

  deferredPrompt = null;
  btnInstalar.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service Worker registrado:", registration);
    } catch (error) {
      console.error("Erro ao registrar Service Worker:", error);
    }
  });
}

window.addEventListener("appinstalled", () => {
  statusEl.textContent = "Status: app instalado com sucesso!";
  btnInstalar.hidden = true;
});