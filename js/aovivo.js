// =========================================================================
// TENNISPRO TV - PAINEL AO VIVO
// CÂMERA TRASEIRA + FIRESTORE + RENDER DO PLACAR + DEBUG NA TELA
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM totalmente carregado. Aguardando Firebase...");

  const checarFirebasePronto = setInterval(() => {
    if (typeof firebase !== "undefined") {
      clearInterval(checarFirebasePronto);
      inicializarPlacarTelevisao();
    }
  }, 50);

  function inicializarPlacarTelevisao() {
    console.log("Firebase detectado! Inicializando painel ao vivo...");

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
    const btnTentarNovamente = document.getElementById("btnTentarNovamente");
    const cameraStatus = document.getElementById("cameraStatus");
    const cameraDebug = document.getElementById("cameraDebug");
    const cameraHint = document.getElementById("cameraHint");
    const tvGridPlacar = document.getElementById("tvGridPlacar");
    const tvStatus = document.getElementById("tvStatus");
    const tvInfoBox = document.getElementById("tvInfoBox");

    let localTimer = null;
    let cameraStream = null;
    let relayInterval = null;
    let latestPayload = null;

    const canalTv = ("BroadcastChannel" in window)
      ? new BroadcastChannel("tennis_tv_channel")
      : null;

    // ---------------------------------------------------------------------
    // DEBUG NA TELA
    // ---------------------------------------------------------------------
    function escapeHtml(str = "") {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function clearDebug() {
      if (cameraStatus) cameraStatus.innerHTML = "";
      if (cameraDebug) cameraDebug.innerHTML = "";
    }

    function appendDebug(msg, isError = false) {
      const time = new Date().toLocaleTimeString("pt-BR");
      const text = `[${time}] ${msg}`;
      console.log(text);

      const lineHtml = ` <div style="font-size:13px; line-height:1.4; color:${isError ? "#ffb4b4" : "#fff"}; white-space:pre-wrap; margin-top:4px;"> ${escapeHtml(text)} </div> `;

      if (cameraStatus) {
        cameraStatus.innerHTML = (cameraStatus.innerHTML || "") + lineHtml;
      }

      if (cameraDebug) {
        cameraDebug.innerHTML = (cameraDebug.innerHTML || "") + lineHtml;
      }
    }

    function showDebugLines(lines = []) {
      clearDebug();
      lines.forEach((line) => appendDebug(line.text, line.type === "error"));
    }

    function setTvInfo(msg = "") {
      if (tvInfoBox) tvInfoBox.textContent = msg;
    }

    function setCameraHint(msg = "") {
      if (cameraHint) cameraHint.textContent = msg;
    }

    function showPermissionHelp() {
      setCameraHint(
        "Permissão da câmera negada no Android. Toque no cadeado na barra do navegador > Permissões > Câmera > Permitir e tente novamente."
      );
      if (btnTentarNovamente) btnTentarNovamente.style.display = "inline-block";
    }

    function hidePermissionHelp() {
      setCameraHint("");
      if (btnTentarNovamente) btnTentarNovamente.style.display = "none";
    }

    // ---------------------------------------------------------------------
    // CÂMERA
    // ---------------------------------------------------------------------
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

    async function tentarBloquearPaisagem() {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape");
          appendDebug("Orientação travada em paisagem com sucesso.");
        }
      } catch (e) {
        appendDebug(`Não foi possível travar paisagem: ${e.message || e}`, true);
      }
    }

    async function ligarCameraTraseira() {
      try {
        hidePermissionHelp();

        showDebugLines([
          { type: "info", text: "Tentando iniciar câmera..." },
          { type: "info", text: `navigator.mediaDevices: ${!!navigator.mediaDevices}` },
          { type: "info", text: `getUserMedia: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}` },
          { type: "info", text: `userAgent: ${navigator.userAgent}` },
          { type: "info", text: `protocol: ${window.location.protocol}` },
          { type: "info", text: `isSecureContext: ${window.isSecureContext}` }
        ]);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia não suportado neste navegador.");
        }

        if (!videoElement) {
          throw new Error("Elemento <video id='liveVideo'> não encontrado.");
        }

        stopCamera();

        let stream = null;

        // 1) PRIMEIRA TENTATIVA: câmera traseira explícita
        try {
          appendDebug("Tentando câmera traseira com facingMode exact environment...");
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch (e1) {
          appendDebug(`Falhou exact environment -> ${e1.name || "Erro"} - ${e1.message || e1}`, true);
        }

        // 2) SEGUNDA TENTATIVA: listar dispositivos e procurar traseira
        if (!stream) {
          try {
            appendDebug("Tentando listar dispositivos de vídeo...");
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((d) => d.kind === "videoinput");

            appendDebug(`Câmeras encontradas: ${videoDevices.length}`);

            if (!videoDevices.length) {
              throw new Error("Nenhuma câmera de vídeo foi encontrada no dispositivo.");
            }

            const backCamera =
              videoDevices.find((d) =>
                /back|rear|environment|traseira|câmera traseira/i.test(d.label || "")
              ) || videoDevices[videoDevices.length - 1];

            appendDebug(`Tentando câmera: ${backCamera.label || backCamera.deviceId || "sem label"}`);

            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: backCamera.deviceId ? { exact: backCamera.deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          } catch (e2) {
            appendDebug(`Falhou deviceId -> ${e2.name || "Erro"} - ${e2.message || e2}`, true);
          }
        }

        // 3) TERCEIRA TENTATIVA: environment ideal
        if (!stream) {
          try {
            appendDebug("Tentando fallback com facingMode ideal environment...");
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          } catch (e3) {
            appendDebug(`Falhou ideal environment -> ${e3.name || "Erro"} - ${e3.message || e3}`, true);
          }
        }

        // 4) ÚLTIMO FALLBACK: qualquer câmera
        if (!stream) {
          try {
            appendDebug("Último fallback: video:true...");
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          } catch (e4) {
            appendDebug(`Falhou video:true -> ${e4.name || "Erro"} - ${e4.message || e4}`, true);
            throw e4;
          }
        }

        cameraStream = stream;

        const tracks = stream.getTracks ? stream.getTracks() : [];
        appendDebug(`Câmera iniciada. Tracks: ${tracks.length}`);

        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.muted = true;
          videoElement.playsInline = true;
          videoElement.setAttribute("autoplay", "");
          videoElement.setAttribute("muted", "");
          videoElement.setAttribute("playsinline", "");

          try {
            await videoElement.play();
            appendDebug("play() executado com sucesso.");
          } catch (playErr) {
            appendDebug(`Erro no play(): ${playErr.name || "Erro"} - ${playErr.message || playErr}`, true);
          }
        }

        appendDebug("Câmera iniciada com sucesso.");
        return true;
      } catch (error) {
        console.error("Erro ao acessar a câmera:", error);

        const nomeErro = error?.name || "Sem nome";
        const mensagemErro = error?.message || String(error);

        let msg = "CÂMERA INDISPONÍVEL";
        if (nomeErro === "NotAllowedError") msg = "PERMISSÃO DE CÂMERA NEGADA";
        else if (nomeErro === "NotFoundError") msg = "NENHUMA CÂMERA FOI ENCONTRADA";
        else if (nomeErro === "NotReadableError") msg = "CÂMERA EM USO POR OUTRO APP";
        else if (nomeErro === "OverconstrainedError") msg = "CONFIGURAÇÃO DA CÂMERA NÃO SUPORTADA";
        else if (nomeErro === "SecurityError") msg = "A CÂMERA EXIGE HTTPS OU LOCALHOST";
        else if (mensagemErro) msg = mensagemErro.toUpperCase();

        if (tvStatus) tvStatus.innerText = "CÂMERA INDISPONÍVEL";

        showDebugLines([
          { type: "error", text: "Falha ao iniciar a câmera." },
          { type: "error", text: `Nome do erro: ${nomeErro}` },
          { type: "error", text: `Mensagem do erro: ${mensagemErro}` },
          { type: "warn", text: `Mensagem exibida: ${msg}` },
          {
            type: "info",
            text:
              "Objeto completo: " +
              JSON.stringify(
                {
                  name: error?.name || null,
                  message: error?.message || null,
                  stack: error?.stack || null
                },
                null,
                2
              )
          }
        ]);

        if (nomeErro === "NotAllowedError") {
          showPermissionHelp();
        }

        return false;
      }
    }

    async function iniciarFluxoTransmissaoNativa() {
      appendDebug("Botão pressionado. Iniciando fluxo...");

      await tentarBloquearPaisagem();

      const sucesso = await ligarCameraTraseira();

      if (sucesso) {
        const telaInicial = document.getElementById("telaInicial");
        if (telaInicial) telaInicial.style.display = "none";
        pedirPlacarAtual();
      } else {
        appendDebug("A câmera falhou. Mantendo a tela inicial visível.", true);
        appendDebug("Verifique as linhas acima para ver o erro real.", false);
      }
    }

    function tentarNovamente() {
      appendDebug("Usuário tocou em 'Tentar novamente'.");
      iniciarFluxoTransmissaoNativa();
    }

    window.iniciarFluxoTransmissaoNativa = iniciarFluxoTransmissaoNativa;
    window.tentarNovamenteCamera = tentarNovamente;

    if (btnAbrirCamera) {
      btnAbrirCamera.addEventListener("click", iniciarFluxoTransmissaoNativa);
    }

    if (btnTentarNovamente) {
      btnTentarNovamente.addEventListener("click", tentarNovamente);
    }

    window.addEventListener("beforeunload", () => {
      stopCamera();
      stopRelay();
      if (canalTv) canalTv.close();
    });

    // ---------------------------------------------------------------------
    // UTILITÁRIOS DE PLACAR
    // ---------------------------------------------------------------------
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

    // ---------------------------------------------------------------------
    // RENDER DO PLACAR
    // ---------------------------------------------------------------------
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
      const ball1 = server === "player1" ? '<span class="serve-ball-tv"></span>' : '';
      const ball2 = server === "player2" ? '<span class="serve-ball-tv"></span>' : '';

      tvGridPlacar.innerHTML = ` <table class="tabela-tv-placar"> <thead> <tr> <th class="th-jogador">Jogador</th> ${setsHtmlHead.join("")} <th class="th-pontos">Pontos</th> </tr> </thead> <tbody> <tr class="linha-jogador-tv"> <td> <div class="nome-tv-atleta">${ball1}<span>${escapeHtml(name1.toUpperCase())}</span></div> </td> ${setsHtmlRow1.join("")} <td class="pontos-tv-score">${viewPts1}</td> </tr> <tr class="linha-jogador-tv"> <td> <div class="nome-tv-atleta">${ball2}<span>${escapeHtml(name2.toUpperCase())}</span></div> </td> ${setsHtmlRow2.join("")} <td class="pontos-tv-score">${viewPts2}</td> </tr> </tbody> </table> `;

      setTvInfo(
        data.court
          ? `Quadra: ${data.court}`
          : (data.tournamentStage ? `Fase: ${data.tournamentStage}` : "")
      );
    }

    // ---------------------------------------------------------------------
    // RECEPTOR DE DADOS
    // ---------------------------------------------------------------------
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

    // ---------------------------------------------------------------------
    // FIRESTORE DIRETO, SE HOUVER ID NA URL
    // ---------------------------------------------------------------------
    if (matchId && matchId !== "null" && window.__db) {
      appendDebug(`Escuta Firestore iniciada para ID: ${matchId}`);

      window.__db.collection("matches").doc(matchId).onSnapshot(
        (doc) => {
          try {
            if (!doc.exists) {
              appendDebug(`Documento não existe no Firestore para o ID: ${matchId}`, true);
              return;
            }

            const data = { id: doc.id, ...doc.data() };
            latestPayload = data;
            renderPlacar(data);
          } catch (innerError) {
            appendDebug(`Erro interno ao renderizar snapshot: ${innerError.message || innerError}`, true);
          }
        },
        (error) => {
          appendDebug(`Erro crítico no Firestore: ${error.name || "Erro"} - ${error.message || error}`, true);
        }
      );
    } else {
      if (tvStatus) tvStatus.innerText = "SEM ID DE PARTIDA";
      appendDebug("Sem parâmetro id. A TV vai aguardar mensagens da aba pública.");
    }

    // Enquanto não chega payload, pede atualização
    relayInterval = setInterval(() => {
      if (!latestPayload) {
        pedirPlacarAtual();
      }
    }, 1000);
  }
});
