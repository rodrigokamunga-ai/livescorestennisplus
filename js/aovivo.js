// =========================================================================
// TENNISPRO TV - PAINEL AO VIVO
// CÂMERA TRASEIRA + FIRESTORE + RENDER DO PLACAR
// SEM LOGS VISUAIS
// TENTA FULLSCREEN APÓS TOQUE DO USUÁRIO
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const checarFirebasePronto = setInterval(() => {
    if (typeof firebase !== "undefined") {
      clearInterval(checarFirebasePronto);
      inicializarPlacarTelevisao();
    }
  }, 50);

  function inicializarPlacarTelevisao() {
    const firebaseConfig = {
      apiKey: "AIzaSyBngwZh3oErADZoTFG6AOqj6QLzwv1R6qY",
      authDomain: "live-scores-tennis-plus.firebaseapp.com",
      projectId: "live-scores-tennis-plus",
      storageBucket: "live-scores-tennis-plus.firebasestorage.app",
      messagingSenderId: "949079557619",
      appId: "1:949079557619:web:d1715339815c28d971be86",
      measurementId: "G-NDT9YVW4C6"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    window.__auth = firebase.auth();
    window.__db = firebase.firestore();
    window.firebaseAppReady = true;

    const params = new URLSearchParams(window.location.search);
    const matchId = (params.get("id") || "").trim();

    const videoElement = document.getElementById("liveVideo");
    const btnAbrirCamera = document.getElementById("btnAbrirCamera");
    const tvGridPlacar = document.getElementById("tvGridPlacar");
    const tvStatus = document.getElementById("tvStatus");
    const tvInfoBox = document.getElementById("tvInfoBox");

    let cameraStream = null;
    let relayInterval = null;
    let latestPayload = null;

    const canalTv = ("BroadcastChannel" in window)
      ? new BroadcastChannel("tennis_tv_channel")
      : null;

    function stopCamera() {
      if (cameraStream && typeof cameraStream.getTracks === "function") {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      cameraStream = null;

      if (videoElement) {
        videoElement.srcObject = null;
      }
    }

    function stopRelay() {
      if (relayInterval) {
        clearInterval(relayInterval);
        relayInterval = null;
      }
    }

    function getGameFormat(match) {
      return String(match?.gameFormat || "Simples").trim();
    }

    function isDoublesFormat(match) {
      const gf = getGameFormat(match);
      return gf === "Duplas" || gf === "Duplas Mistas";
    }

    function renderPlayerNameTV(match, which) {
      const doubles = isDoublesFormat(match);

      if (!doubles) {
        return which === 1
          ? String(match.player1 || "Jogador 1").trim()
          : String(match.player2 || "Jogador 2").trim();
      }

      const p1 = which === 1
        ? String(match.player1 || "Jogador 1").trim()
        : String(match.player3 || "Jogador 3").trim();
      const p2 = which === 1
        ? String(match.player2 || "Jogador 2").trim()
        : String(match.player4 || "Jogador 4").trim();

      return `${p1}/${p2}`;
    }

    function durationText(ms) {
      if (!ms || ms < 0) return "00:00:00";
      const s = Math.floor(ms / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    }

    function mapStatus(status) {
      switch (String(status || "").toLowerCase()) {
        case "live": return "EM ANDAMENTO";
        case "suspended": return "SUSPENSA";
        case "finished": return "FINALIZADA";
        case "wo": return "WO";
        case "ret": return "RET";
        default: return "NÃO INICIADA";
      }
    }

    function normalizeScoreLocal(score = {}) {
      return {
        points1: Number(score.points1 || 0),
        points2: Number(score.points2 || 0),
        games1: Number(score.games1 || 0),
        games2: Number(score.games2 || 0),
        sets1: Number(score.sets1 || 0),
        sets2: Number(score.sets2 || 0),
        tieBreakMode: score.tieBreakMode === "tb7" || score.tieBreakMode === "super10" ? score.tieBreakMode : null,
        tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
        tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
        lastTieBreakMode: score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10" ? score.lastTieBreakMode : null,
        lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
        lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
        setHistory: Array.isArray(score.setHistory) ? score.setHistory : [],
        server: score.server || "player1",
        advantage: score.advantage || null
      };
    }

    function tennisPointLabelLocal(points) {
      switch (Number(points || 0)) {
        case 0: return "00";
        case 1: return "15";
        case 2: return "30";
        case 3: return "40";
        default: return "40";
      }
    }

    function getPointDisplayTV(score, matchFormat, isFinished = false) {
      if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
        return { p1: String(score.tieBreakPoints1 ?? 0), p2: String(score.tieBreakPoints2 ?? 0) };
      }

      if (isFinished && (score.lastTieBreakMode === "tb7" || score.lastTieBreakMode === "super10")) {
        return { p1: String(score.lastTieBreakPoints1 ?? 0), p2: String(score.lastTieBreakPoints2 ?? 0) };
      }

      const fmt = String(matchFormat || "").toLowerCase();
      const noAd = fmt.includes("sem vantagem") || fmt.includes("no ad") || fmt.includes("no-ad");
      const hasAd = fmt.includes("com vantagem") || fmt.includes("3 sets");
      const p1 = score.points1;
      const p2 = score.points2;

      if (hasAd && !noAd) {
        if (score.advantage === "player1") return { p1: "AD", p2: "40" };
        if (score.advantage === "player2") return { p1: "40", p2: "AD" };
        if (p1 >= 3 && p2 >= 3) {
          if (p1 === p2) return { p1: "40", p2: "40" };
          if (p1 > p2) return { p1: "AD", p2: "40" };
          if (p2 > p1) return { p1: "40", p2: "AD" };
        }
        return { p1: tennisPointLabelLocal(p1), p2: tennisPointLabelLocal(p2) };
      }

      if (noAd) {
        if (p1 === 3 && p2 === 3) return { p1: "40", p2: "40" };
        return { p1: tennisPointLabelLocal(p1), p2: tennisPointLabelLocal(p2) };
      }

      if (score.advantage === "player1") return { p1: "AD", p2: "40" };
      if (score.advantage === "player2") return { p1: "40", p2: "AD" };

      if (p1 >= 3 && p2 >= 3) {
        if (p1 === p2) return { p1: "40", p2: "40" };
        if (p1 > p2) return { p1: "AD", p2: "40" };
        if (p2 > p1) return { p1: "40", p2: "AD" };
      }

      return { p1: tennisPointLabelLocal(p1), p2: tennisPointLabelLocal(p2) };
    }

    function toDateLocal(value) {
      if (!value) return null;
      if (value.toDate && typeof value.toDate === "function") return value.toDate();
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }

    function buildDurationLocal(match) {
      const accumulated = Number(match.accumulatedSeconds || 0);

      if (match.status === "suspended") {
        return durationText(accumulated * 1000);
      }

      if (match.status === "live") {
        const started = toDateLocal(match.startedAt);
        if (started && !isNaN(started.getTime())) {
          const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
          return durationText((accumulated + elapsed) * 1000);
        }
        return durationText(accumulated * 1000);
      }

      if (match.durationSeconds && Number(match.durationSeconds) > 0) {
        return durationText(Number(match.durationSeconds) * 1000);
      }

      return "00:00:00";
    }

    function getSetColumnsLocal(match, score) {
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];

      function formatSet(setObj) {
        if (!setObj) return { p1: "0", p2: "0", tb1: 0, tb2: 0 };
        const g1 = Number(setObj.games1 ?? 0);
        const g2 = Number(setObj.games2 ?? 0);
        const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
        const tb2 = Number(setObj.tieBreakPoints2 ?? 0);

        if (setObj.tieBreakMode === "tb7" || setObj.tieBreakMode === "super10") {
          if (tb1 > 0 || tb2 > 0) {
            return {
              p1: String(tb1 > tb2 ? 7 : 6),
              p2: String(tb1 > tb2 ? 6 : 7),
              tb1: tb1 > tb2 ? tb1 : 0,
              tb2: tb2 > tb1 ? tb2 : 0
            };
          }
        }

        return { p1: String(g1), p2: String(g2), tb1: 0, tb2: 0 };
      }

      const setsTratados = [];
      for (let i = 0; i < 3; i++) {
        if (history[i]) {
          setsTratados.push(formatSet(history[i]));
        } else if (history.length === i) {
          setsTratados.push({
            p1: String(score.games1 ?? 0),
            p2: String(score.games2 ?? 0),
            tb1: 0,
            tb2: 0
          });
        }
      }

      return setsTratados;
    }

    function renderPlacar(data) {
      if (!data || !data.score || !tvGridPlacar) return;

      const score = normalizeScoreLocal(data.score || {});
      const history = Array.isArray(score.setHistory) ? score.setHistory : [];

      const fmt = String(data.matchFormat || "").toLowerCase();
      const hasTwoSets = fmt.includes("2 sets");
      const hasThreeSets = fmt.includes("3 sets");

      let qtdCols = 1;
      if (hasTwoSets || hasThreeSets) qtdCols = 2;
      if (hasThreeSets) qtdCols = 3;

      const isDuplas = String(data.gameFormat || "").includes("Duplas");
      let name1 = String(data.player1 || "Jogador 1");
      let name2 = String(data.player2 || "Jogador 2");

      if (isDuplas) {
        name1 = `${data.player1 || "Jogador 1"}/${data.player2 || "Jogador 2"}`;
        name2 = `${data.player3 || "Jogador 3"}/${data.player4 || "Jogador 4"}`;
      }

      const isTieBreakAtivo = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";
      let viewPts1 = "00";
      let viewPts2 = "00";

      if (isTieBreakAtivo) {
        viewPts1 = String(score.tieBreakPoints1 ?? 0);
        viewPts2 = String(score.tieBreakPoints2 ?? 0);
        if (tvStatus) {
          tvStatus.innerText = score.tieBreakMode === "super10" ? "SUPER TIE-BREAK" : "TIE-BREAK";
        }
      } else {
        if (tvStatus) {
          if (data.status === "live") tvStatus.innerText = "EM ANDAMENTO";
          else if (data.status === "suspended") tvStatus.innerText = "SUSPENSA";
          else if (data.status === "finished") tvStatus.innerText = "FINALIZADA";
          else tvStatus.innerText = "NÃO INICIADA";
        }

        const deparaTenis = { "0": "00", "1": "15", "2": "30", "3": "40" };

        if (score.advantage === "player1") {
          viewPts1 = "AD";
          viewPts2 = "40";
        } else if (score.advantage === "player2") {
          viewPts1 = "40";
          viewPts2 = "AD";
        } else {
          viewPts1 = deparaTenis[String(score.points1 ?? 0)] || "00";
          viewPts2 = deparaTenis[String(score.points2 ?? 0)] || "00";
        }
      }

      const setsHtmlHead = [];
      const setsHtmlRow1 = [];
      const setsHtmlRow2 = [];

      for (let i = 0; i < qtdCols; i++) {
        setsHtmlHead.push(`<th class="th-set">${i + 1}º SET</th>`);

        const g1 = history[i]
          ? String(history[i].games1 ?? 0)
          : (history.length === i ? String(score.games1 ?? 0) : "--");

        const g2 = history[i]
          ? String(history[i].games2 ?? 0)
          : (history.length === i ? String(score.games2 ?? 0) : "--");

        setsHtmlRow1.push(`<td class="set-tv-score">${g1}</td>`);
        setsHtmlRow2.push(`<td class="set-tv-score">${g2}</td>`);
      }

      const server = score.server || data.server || "player1";
      const ball1 = server === "player1" ? '<span class="serve-ball-tv"></span>' : "";
      const ball2 = server === "player2" ? '<span class="serve-ball-tv"></span>' : "";

      tvGridPlacar.innerHTML = ` <table class="tabela-tv-placar"> <thead> <tr> <th class="th-jogador">Jogador</th> ${setsHtmlHead.join("")} <th class="th-pontos">Pontos</th> </tr> </thead> <tbody> <tr class="linha-jogador-tv"> <td> <div class="nome-tv-atleta">${ball1}<span>${escapeHtml(name1.toUpperCase())}</span></div> </td> ${setsHtmlRow1.join("")} <td class="pontos-tv-score">${viewPts1}</td> </tr> <tr class="linha-jogador-tv"> <td> <div class="nome-tv-atleta">${ball2}<span>${escapeHtml(name2.toUpperCase())}</span></div> </td> ${setsHtmlRow2.join("")} <td class="pontos-tv-score">${viewPts2}</td> </tr> </tbody> </table> `;

      if (tvInfoBox) {
        tvInfoBox.textContent = data.court ? `Quadra: ${data.court}` : (data.tournamentStage ? `Fase: ${data.tournamentStage}` : "");
      }
    }

    function processPayload(payload) {
      if (!payload) return;

      if (payload.score) {
        latestPayload = payload;
        stopRelay();
        renderPlacar(payload);
        return;
      }

      if (payload.type === "matchUpdate" && payload.match && payload.match.score) {
        latestPayload = payload.match;
        stopRelay();
        renderPlacar(payload.match);
        return;
      }
    }

    function pedirPlacarAtual() {
      if (canalTv) {
        canalTv.postMessage("PEDIR_PLACAR_ATUAL");
      }

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "PEDIR_PLACAR_ATUAL" }, "*");
      }

      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "PEDIR_PLACAR_ATUAL" }, "*");
      }
    }

    if (canalTv) {
      canalTv.onmessage = (event) => {
        processPayload(event.data);
      };
    }

    window.addEventListener("message", (event) => {
      processPayload(event.data);
    });

    async function entrarFullscreen() {
      try {
        const target = document.documentElement;
        if (target.requestFullscreen) {
          await target.requestFullscreen({ navigationUI: "hide" });
        }
      } catch (_) {
        // silencioso
      }
    }

    async function ligarCameraTraseira() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      if (!videoElement) {
        return false;
      }

      stopCamera();

      let stream = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (_) {}

      if (!stream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          const backCamera =
            videoDevices.find((d) => /back|rear|environment|traseira/i.test(d.label || "")) ||
            videoDevices[videoDevices.length - 1];

          if (backCamera) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: backCamera.deviceId ? { exact: backCamera.deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          }
        } catch (_) {}
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch (_) {}
      }

      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      cameraStream = stream;

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute("autoplay", "");
        videoElement.setAttribute("muted", "");
        videoElement.setAttribute("playsinline", "");
        try {
          await videoElement.play();
        } catch (_) {}
      }

      return true;
    }

    async function iniciarFluxoTransmissaoNativa() {
      await entrarFullscreen();

      const sucesso = await ligarCameraTraseira();

      if (sucesso) {
        const telaInicial = document.getElementById("telaInicial");
        if (telaInicial) telaInicial.style.display = "none";
        pedirPlacarAtual();
      }
    }

    window.iniciarFluxoTransmissaoNativa = iniciarFluxoTransmissaoNativa;

    if (btnAbrirCamera) {
      btnAbrirCamera.addEventListener("click", iniciarFluxoTransmissaoNativa);
    }

    window.addEventListener("beforeunload", () => {
      stopCamera();
      stopRelay();
      if (canalTv) canalTv.close();
    });

    if (matchId && matchId !== "null" && window.__db) {
      window.__db.collection("matches").doc(matchId).onSnapshot(
        (doc) => {
          try {
            if (!doc.exists) return;
            const data = { id: doc.id, ...doc.data() };
            latestPayload = data;
            renderPlacar(data);
          } catch (_) {}
        },
        () => {}
      );
    } else {
      if (tvStatus) tvStatus.innerText = "SEM ID DE PARTIDA";
    }

    relayInterval = setInterval(() => {
      if (!latestPayload) {
        pedirPlacarAtual();
      }
    }, 1000);
  }
});
