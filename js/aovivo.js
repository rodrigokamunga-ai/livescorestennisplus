document.addEventListener("DOMContentLoaded", () => {
  console.log("[Ao Vivo] DOM carregado.");

  let attempts = 0;
  let appStarted = false;

  const dependencyTimer = setInterval(() => {
    attempts++;

    const firebaseReady =
      typeof window.firebase !== "undefined";

    const liveKitReady =
      typeof window.LivekitClient !== "undefined" ||
      typeof window.LiveKitClient !== "undefined" ||
      typeof window.livekitClient !== "undefined";

    if (
      !window.LivekitClient &&
      window.LiveKitClient
    ) {
      window.LivekitClient =
        window.LiveKitClient;
    }

    if (
      !window.LivekitClient &&
      window.livekitClient
    ) {
      window.LivekitClient =
        window.livekitClient;
    }

    console.log(
      `[Ao Vivo] Firebase: ${ firebaseReady ? "OK" : "AGUARDANDO" } | LiveKit: ${ liveKitReady ? "OK" : "AGUARDANDO" }`
    );

    if (
      firebaseReady &&
      liveKitReady &&
      !appStarted
    ) {
      appStarted = true;
      clearInterval(dependencyTimer);

      console.log(
        "[Ao Vivo] Dependências carregadas."
      );

      initApp();
    }

    if (
      attempts >= 100 &&
      !appStarted
    ) {
      clearInterval(dependencyTimer);

      const status =
        document.getElementById("tvStatus");

      const info =
        document.getElementById("tvInfoBox");

      if (status) {
        status.textContent =
          liveKitReady
            ? "FIREBASE NÃO CARREGADO"
            : "LIVEKIT NÃO CARREGADO";
      }

      if (info) {
        info.textContent =
          liveKitReady
            ? "Verifique o carregamento do Firebase."
            : "Verifique o SDK do LiveKit no HTML.";
      }

      console.error(
        "[Ao Vivo] Dependências não carregadas.",
        {
          firebaseReady,
          liveKitReady
        }
      );
    }
  }, 100);

  async function initApp() {
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

    const db = firebase.firestore();

    window.__db = db;
    window.firebaseAppReady = true;

    const LIVEKIT_URL =
      "wss://livescoretennis-hkk3b2oi.livekit.cloud";

    const LIVEKIT_TOKEN_SERVER_ID =
      "livescoretennis-97cavx";

    const params =
      new URLSearchParams(
        window.location.search
      );

    const matchId =
      String(params.get("id") || "").trim();

    const role =
      String(params.get("role") || "viewer")
        .trim()
        .toLowerCase();

    const shareToken =
      String(params.get("shareToken") || "")
        .trim();

    const videoEl =
      document.getElementById("liveVideo");

    const videoWrap =
      document.getElementById("videoWrap");

    const btnAbrirCamera =
      document.getElementById("btnAbrirCamera");

    const btnExpandirTela =
      document.getElementById("btnExpandirTela");

    const btnTentarNovamente =
      document.getElementById("btnTentarNovamente");

    const btnIniciarGravacao =
      document.getElementById("btnIniciarGravacao");

    const btnPararGravacao =
      document.getElementById("btnPararGravacao");

    const btnAtivarAudio =
      document.getElementById("btnAtivarAudio");

    const btnAtualizarTela =
      document.getElementById("btnAtualizarTela");

    const cameraStatus =
      document.getElementById("cameraStatus");

    const cameraDebug =
      document.getElementById("cameraDebug");

    const tvStatus =
      document.getElementById("tvStatus");

    const tvInfoBox =
      document.getElementById("tvInfoBox");

    const telaInicial =
      document.getElementById("telaInicial");

    const tvGridPlacar =
      document.getElementById("tvGridPlacar");

    const liveEndingMessage =
      document.getElementById(
        "liveEndingMessage"
      );

    let viewerStartButton = null;

    const state = {
      match: null,

      liveKitRoom: null,
      liveKitLocalTracks: [],
      liveKitAudioElements: [],

      localStream: null,
      unsubMatch: null,

      started: false,
      transmissionEnded: false,
      refreshLock: false,
      finishTimer: null,

      mediaRecorder: null,
      recordedChunks: [],
      recordingMimeType: "",
      isRecording: false,

      recordingCanvas: null,
      recordingContext: null,
      recordingStream: null,
      recordingAnimationFrame: null,
      scoreboardSnapshotCanvas: null
    };

    function escapeHtml(value = "") {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function logLine(message, isError = false) {
      const line =
        `[${new Date().toLocaleTimeString( "pt-BR" )}] ${message}`;

      console[isError ? "error" : "log"](line);

      [cameraStatus, cameraDebug].forEach(
        (target) => {
          if (!target) return;

          const div =
            document.createElement("div");

          div.textContent = line;
          target.appendChild(div);
        }
      );
    }

    function setStatus(text) {
      if (tvStatus) {
        tvStatus.textContent = text || "";
      }
    }

    function setInfo(text) {
      if (tvInfoBox) {
        tvInfoBox.textContent = text || "";
      }
    }

    function showInitialScreen( text = "Aguardando vídeo..." ) {
      if (!telaInicial) return;

      telaInicial.innerHTML = "";
      telaInicial.style.display = "flex";
      telaInicial.style.pointerEvents = "auto";
      telaInicial.style.flexDirection = "column";
      telaInicial.style.alignItems = "center";
      telaInicial.style.justifyContent = "center";
      telaInicial.style.gap = "10px";

      if (role === "viewer") {
        viewerStartButton =
          document.createElement("button");

        viewerStartButton.type = "button";
        viewerStartButton.className =
          "btn green";

        /* Tamanho normal do botão no celular. */
        viewerStartButton.style.width =
          "auto";

        viewerStartButton.style.minWidth =
          "auto";

        viewerStartButton.style.maxWidth =
          "220px";

        viewerStartButton.style.padding =
          "9px 13px";

        viewerStartButton.style.borderRadius =
          "9px";

        viewerStartButton.style.fontSize =
          "13px";

        viewerStartButton.style.lineHeight =
          "1";

        viewerStartButton.style.flex =
          "0 0 auto";

        viewerStartButton.style.pointerEvents =
          "auto";

        viewerStartButton.innerHTML = ` <ion-icon name="radio-outline"></ion-icon> <span>Iniciar transmissão</span> `;

        viewerStartButton.addEventListener(
          "click",
          async (event) => {
            event.preventDefault();
            event.stopPropagation();

            await activateViewerAudio();
          }
        );

        telaInicial.appendChild(
          viewerStartButton
        );
      }

      const message =
        document.createElement("div");

      message.textContent = text;
      message.style.fontWeight = "900";
      message.style.textAlign = "center";
      message.style.fontSize = "13px";

      telaInicial.appendChild(message);
    }

    function hideInitialScreen() {
      if (telaInicial) {
        telaInicial.style.display = "none";
        telaInicial.style.pointerEvents =
          "none";
      }
    }

    function ensureVideoVisible() {
      if (videoEl) {
        videoEl.style.display = "block";
        videoEl.style.visibility = "visible";
        videoEl.style.opacity = "1";
      }

      hideInitialScreen();
    }

    function getTimestampDate(value) {
      if (!value) return null;

      if (
        value.toDate &&
        typeof value.toDate === "function"
      ) {
        return value.toDate();
      }

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    function getMatchRef() {
      return db.collection("matches").doc(matchId);
    }

    function normalizeScore(score = {}) {
      return {
        points1: Number(score.points1 || 0),
        points2: Number(score.points2 || 0),
        games1: Number(score.games1 || 0),
        games2: Number(score.games2 || 0),
        sets1: Number(score.sets1 || 0),
        sets2: Number(score.sets2 || 0),

        tieBreakMode:
          score.tieBreakMode === "tb7" ||
          score.tieBreakMode === "super10"
            ? score.tieBreakMode
            : null,

        tieBreakPoints1: Number(
          score.tieBreakPoints1 || 0
        ),

        tieBreakPoints2: Number(
          score.tieBreakPoints2 || 0
        ),

        lastTieBreakMode:
          score.lastTieBreakMode === "tb7" ||
          score.lastTieBreakMode === "super10"
            ? score.lastTieBreakMode
            : null,

        lastTieBreakPoints1: Number(
          score.lastTieBreakPoints1 || 0
        ),

        lastTieBreakPoints2: Number(
          score.lastTieBreakPoints2 || 0
        ),

        setHistory: Array.isArray(
          score.setHistory
        )
          ? score.setHistory
          : [],

        server: score.server || "player1",
        advantage: score.advantage || null
      };
    }

    function tennisPointLabel(points) {
      switch (Number(points || 0)) {
        case 0:
          return "0";
        case 1:
          return "15";
        case 2:
          return "30";
        case 3:
          return "40";
        default:
          return "40";
      }
    }

    function getPointDisplay( score, matchFormat, isFinished = false ) {
      if (
        score.tieBreakMode === "tb7" ||
        score.tieBreakMode === "super10"
      ) {
        return {
          p1: String(score.tieBreakPoints1 || 0),
          p2: String(score.tieBreakPoints2 || 0)
        };
      }

      if (
        isFinished &&
        (
          score.lastTieBreakMode === "tb7" ||
          score.lastTieBreakMode === "super10"
        )
      ) {
        return {
          p1: String(
            score.lastTieBreakPoints1 || 0
          ),
          p2: String(
            score.lastTieBreakPoints2 || 0
          )
        };
      }

      const format =
        String(matchFormat || "")
          .toLowerCase();

      const noAd =
        format.includes("sem vantagem") ||
        format.includes("no ad") ||
        format.includes("no-ad");

      const hasAdvantage =
        format.includes("com vantagem") ||
        format.includes("3 sets");

      const points1 =
        Number(score.points1 || 0);

      const points2 =
        Number(score.points2 || 0);

      if (hasAdvantage && !noAd) {
        if (score.advantage === "player1") {
          return { p1: "AD", p2: "40" };
        }

        if (score.advantage === "player2") {
          return { p1: "40", p2: "AD" };
        }

        if (points1 >= 3 && points2 >= 3) {
          if (points1 === points2) {
            return { p1: "40", p2: "40" };
          }

          if (points1 > points2) {
            return { p1: "AD", p2: "40" };
          }

          return { p1: "40", p2: "AD" };
        }
      }

      if (
        noAd &&
        points1 === 3 &&
        points2 === 3
      ) {
        return { p1: "40", p2: "40" };
      }

      if (score.advantage === "player1") {
        return { p1: "AD", p2: "40" };
      }

      if (score.advantage === "player2") {
        return { p1: "40", p2: "AD" };
      }

      if (points1 >= 3 && points2 >= 3) {
        if (points1 === points2) {
          return { p1: "40", p2: "40" };
        }

        if (points1 > points2) {
          return { p1: "AD", p2: "40" };
        }

        return { p1: "40", p2: "AD" };
      }

      return {
        p1: tennisPointLabel(points1),
        p2: tennisPointLabel(points2)
      };
    }

    function isDoubles(match) {
      const format =
        String(match.gameFormat || "")
          .trim();

      return (
        format === "Duplas" ||
        format === "Duplas Mistas"
      );
    }

    function getPlayerNames(match) {
      const player1 =
        String(match.player1 || "Jogador A")
          .trim();

      const player2 =
        String(match.player2 || "Jogador B")
          .trim();

      if (!isDoubles(match)) {
        return {
          player1,
          player2
        };
      }

      const player3 =
        String(match.player3 || "Jogador C")
          .trim();

      const player4 =
        String(match.player4 || "Jogador D")
          .trim();

      return {
        player1: `${player1}/${player2}`,
        player2: `${player3}/${player4}`
      };
    }

    function getSetScoreValue( setData, playerPosition, isCompleted = true ) {
      if (!setData) return "";

      const gamesKey =
        playerPosition === 1
          ? "games1"
          : "games2";

      const games =
        Number(setData[gamesKey] || 0);

      const tieBreakMode =
        setData.tieBreakMode === "tb7" ||
        setData.tieBreakMode === "super10";

      if (!tieBreakMode) {
        return String(games);
      }

      const tb1 =
        Number(setData.tieBreakPoints1 || 0);

      const tb2 =
        Number(setData.tieBreakPoints2 || 0);

      if (
        setData.tieBreakMode === "super10"
      ) {
        return String(
          playerPosition === 1 ? tb1 : tb2
        );
      }

      let finalGames1 = 6;
      let finalGames2 = 6;

      if (
        isCompleted &&
        (tb1 > 0 || tb2 > 0)
      ) {
        if (tb1 > tb2) {
          finalGames1 = 7;
          finalGames2 = 6;
        } else if (tb2 > tb1) {
          finalGames1 = 6;
          finalGames2 = 7;
        }
      }

      return {
        main:
          playerPosition === 1
            ? String(finalGames1)
            : String(finalGames2),

        tieBreak: String(
          playerPosition === 1 ? tb1 : tb2
        )
      };
    }

    function getVisibleSetCount(match, score) {
      const history =
        Array.isArray(score.setHistory)
          ? score.setHistory
          : [];

      const status =
        String(match.status || "")
          .toLowerCase();

      const isFinished =
        status === "finished" ||
        status === "wo" ||
        status === "ret";

      if (isFinished) {
        return Math.max(
          1,
          Math.min(3, history.length)
        );
      }

      return Math.max(
        1,
        Math.min(3, history.length + 1)
      );
    }

    function getSetValues( match, score, playerPosition, visibleSetCount ) {
      const history =
        Array.isArray(score.setHistory)
          ? score.setHistory
          : [];

      const status =
        String(match.status || "")
          .toLowerCase();

      const isFinished =
        status === "finished" ||
        status === "wo" ||
        status === "ret";

      const values = [];

      for (
        let index = 0;
        index < visibleSetCount;
        index++
      ) {
        if (history[index]) {
          values.push(
            getSetScoreValue(
              history[index],
              playerPosition,
              true
            )
          );

          continue;
        }

        const isCurrentSet =
          !isFinished &&
          index === history.length;

        if (!isCurrentSet) {
          values.push("");
          continue;
        }

        if (
          score.tieBreakMode === "super10"
        ) {
          values.push(
            playerPosition === 1
              ? String(
                  score.tieBreakPoints1 || 0
                )
              : String(
                  score.tieBreakPoints2 || 0
                )
          );

          continue;
        }

        if (
          score.tieBreakMode === "tb7"
        ) {
          values.push({
            main: "6",
            tieBreak:
              playerPosition === 1
                ? String(
                    score.tieBreakPoints1 || 0
                  )
                : String(
                    score.tieBreakPoints2 || 0
                  )
          });

          continue;
        }

        values.push(
          playerPosition === 1
            ? String(score.games1 || 0)
            : String(score.games2 || 0)
        );
      }

      return values;
    }

    function renderSetValue( value, isCurrent = false ) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return ` <span class="aovivo-compact-number empty" ></span> `;
      }

      if (typeof value === "object") {
        return ` <span class="aovivo-compact-number ${ isCurrent ? "current" : "" }" > <span class="aovivo-compact-score-set"> <span class="aovivo-compact-score-main"> ${escapeHtml(value.main)} </span> <span class="aovivo-compact-score-tb"> ${escapeHtml(value.tieBreak)} </span> </span> </span> `;
      }

      return ` <span class="aovivo-compact-number ${ isCurrent ? "current" : "" }" > ${escapeHtml(String(value))} </span> `;
    }

    function renderCompactPlayerRow( match, score, playerPosition, pointDisplay, visibleSetCount, isFinished ) {
      const names =
        getPlayerNames(match);

      const playerName =
        playerPosition === 1
          ? names.player1
          : names.player2;

      const setValues =
        getSetValues(
          match,
          score,
          playerPosition,
          visibleSetCount
        );

      const setMarkup = [];

      for (
        let index = 0;
        index < visibleSetCount;
        index++
      ) {
        setMarkup.push(
          renderSetValue(
            setValues[index] ?? "",
            index === visibleSetCount - 1
          )
        );
      }

      const showPoints = !isFinished;

      const nameColumn =
        window.innerWidth <= 480
          ? "112px"
          : window.innerWidth <= 768
            ? "130px"
            : "150px";

      const scoreColumns =
        Array.from(
          {
            length: visibleSetCount
          },
          () => "21px"
        ).join(" ");

      const columns = showPoints
        ? ` ${nameColumn} ${scoreColumns} 26px `
        : ` ${nameColumn} ${scoreColumns} `;

      const server =
        score.server || "player1";

      const isServing =
        playerPosition === 1
          ? server === "player1"
          : server === "player2";

      const pointValue =
        playerPosition === 1
          ? pointDisplay.p1
          : pointDisplay.p2;

      return ` <div class="aovivo-compact-row" style=" grid-template-columns: ${columns}; width: fit-content; " > <div class="aovivo-compact-name"> <span class="aovivo-compact-serve ${ isServing ? "" : "hidden" }" ></span> <span class="aovivo-compact-player"> ${escapeHtml(playerName)} </span> </div> ${setMarkup.join("")} ${ showPoints ? ` <span class=" aovivo-compact-number current " > ${escapeHtml(pointValue)} </span> ` : "" } </div> `;
    }

    function renderPlacar(match) {
      if (!match || !tvGridPlacar) {
        return;
      }

      const score =
        normalizeScore(match.score || {});

      const status =
        String(match.status || "")
          .toLowerCase();

      const isFinished =
        status === "finished" ||
        status === "wo" ||
        status === "ret";

      const pointDisplay =
        getPointDisplay(
          score,
          match.matchFormat,
          isFinished
        );

      const visibleSetCount =
        getVisibleSetCount(
          match,
          score
        );

      const stateClass =
        isFinished
          ? "finished"
          : "live";

      tvGridPlacar.innerHTML = ` <div class=" aovivo-compact-scoreboard ${stateClass} sets-${visibleSetCount} " > ${renderCompactPlayerRow( match, score, 1, pointDisplay, visibleSetCount, isFinished )} ${renderCompactPlayerRow( match, score, 2, pointDisplay, visibleSetCount, isFinished )} </div> `;
    }

    function createIdentity() {
      if (role === "broadcaster") {
        return `broadcaster-${Date.now()}`;
      }

      return `viewer-${Date.now()}-${Math.random() .toString(36) .slice(2, 8)}`;
    }

    async function getLiveKitCredentials() {
      if (
        typeof LivekitClient ===
        "undefined"
      ) {
        throw new Error(
          "SDK LiveKit não carregado."
        );
      }

      if (
        !LivekitClient.TokenSource ||
        typeof LivekitClient.TokenSource
          .sandboxTokenServer !==
          "function"
      ) {
        throw new Error(
          "Token Server LiveKit não disponível."
        );
      }

      const roomName =
        `match-${matchId}`;

      const identity =
        createIdentity();

      const tokenSource =
        LivekitClient.TokenSource
          .sandboxTokenServer(
            "livescoretennis-97cavx"
          );

      const result =
        await tokenSource.fetch({
          roomName,
          participantName: identity,
          participantIdentity: identity,
          participantMetadata:
            JSON.stringify({
              role,
              matchId
            })
        });

      const token =
        result.participantToken ||
        result.token;

      const serverUrl =
        result.serverUrl ||
        result.server_url ||
        "wss://livescoretennis-hkk3b2oi.livekit.cloud";

      if (!token) {
        throw new Error(
          "Token Server não retornou token."
        );
      }

      return {
        token,
        serverUrl,
        roomName,
        identity
      };
    }

    function getSupportedRecordingMimeType() {
      if (
        typeof MediaRecorder ===
        "undefined"
      ) {
        return "";
      }

      const types = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ];

      for (const type of types) {
        if (
          MediaRecorder.isTypeSupported(type)
        ) {
          return type;
        }
      }

      return "";
    }

    function updateRecordingButtons() {
      const broadcaster =
        role === "broadcaster";

      if (btnIniciarGravacao) {
        btnIniciarGravacao.style.display =
          broadcaster &&
          !state.isRecording
            ? "inline-flex"
            : "none";
      }

      if (btnPararGravacao) {
        btnPararGravacao.style.display =
          broadcaster &&
          state.isRecording
            ? "inline-flex"
            : "none";
      }
    }
    async function updateScoreboardRecordingSnapshot() {
      if (
        typeof html2canvas ===
          "undefined" ||
        !tvGridPlacar ||
        !state.recordingCanvas
      ) {
        return;
      }

      try {
        state.scoreboardSnapshotCanvas =
          await html2canvas(
            tvGridPlacar,
            {
              backgroundColor: null,
              scale: 1,
              useCORS: true,
              logging: false
            }
          );
      } catch (_) {}
    }

    function getRecordingCanvasSize() {
      return {
        width:
          videoEl?.videoWidth ||
          videoEl?.clientWidth ||
          1280,

        height:
          videoEl?.videoHeight ||
          videoEl?.clientHeight ||
          720
      };
    }

    function drawRecordingFrame() {
      if (
        !state.recordingCanvas ||
        !state.recordingContext ||
        !videoEl ||
        videoEl.readyState < 2
      ) {
        state.recordingAnimationFrame =
          requestAnimationFrame(
            drawRecordingFrame
          );

        return;
      }

      const canvas =
        state.recordingCanvas;

      const context =
        state.recordingContext;

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      context.drawImage(
        videoEl,
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (
        state.scoreboardSnapshotCanvas &&
        videoWrap &&
        tvGridPlacar
      ) {
        const videoRect =
          videoWrap.getBoundingClientRect();

        const scoreRect =
          tvGridPlacar.getBoundingClientRect();

        if (
          videoRect.width > 0 &&
          videoRect.height > 0
        ) {
          const scaleX =
            canvas.width /
            videoRect.width;

          const scaleY =
            canvas.height /
            videoRect.height;

          context.drawImage(
            state.scoreboardSnapshotCanvas,
            (scoreRect.left -
              videoRect.left) * scaleX,
            (scoreRect.top -
              videoRect.top) * scaleY,
            scoreRect.width * scaleX,
            scoreRect.height * scaleY
          );
        }
      }

      state.recordingAnimationFrame =
        requestAnimationFrame(
          drawRecordingFrame
        );
    }

    function createRecordingStream() {
      const size =
        getRecordingCanvasSize();

      const canvas =
        document.createElement("canvas");

      canvas.width = size.width;
      canvas.height = size.height;

      state.recordingCanvas = canvas;
      state.recordingContext =
        canvas.getContext("2d");

      const stream =
        canvas.captureStream(30);

      state.liveKitLocalTracks
        .forEach((localTrack) => {
          const track =
            localTrack.mediaStreamTrack;

          if (
            track &&
            track.kind === "audio"
          ) {
            stream.addTrack(track);
          }
        });

      state.recordingStream = stream;
      drawRecordingFrame();

      return stream;
    }

    function stopRecordingCanvas() {
      if (
        state.recordingAnimationFrame
      ) {
        cancelAnimationFrame(
          state.recordingAnimationFrame
        );

        state.recordingAnimationFrame =
          null;
      }

      if (state.recordingStream) {
        state.recordingStream
          .getVideoTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch (_) {}
          });
      }

      state.recordingStream = null;
      state.recordingCanvas = null;
      state.recordingContext = null;
      state.scoreboardSnapshotCanvas =
        null;
    }

    async function startRecording() {
      if (role !== "broadcaster") {
        return;
      }

      if (
        !state.liveKitLocalTracks.length
      ) {
        alert(
          "A câmera ainda não foi iniciada."
        );

        return;
      }

      if (
        typeof MediaRecorder ===
        "undefined"
      ) {
        alert(
          "Este navegador não suporta gravação."
        );

        return;
      }

      try {
        state.recordedChunks = [];

        state.recordingMimeType =
          getSupportedRecordingMimeType();

        await updateScoreboardRecordingSnapshot();

        const stream =
          createRecordingStream();

        const options =
          state.recordingMimeType
            ? {
                mimeType:
                  state.recordingMimeType,
                videoBitsPerSecond:
                  2500000,
                audioBitsPerSecond:
                  128000
              }
            : {};

        state.mediaRecorder =
          new MediaRecorder(
            stream,
            options
          );

        state.mediaRecorder.ondataavailable =
          (event) => {
            if (
              event.data &&
              event.data.size > 0
            ) {
              state.recordedChunks.push(
                event.data
              );
            }
          };

        state.mediaRecorder.onstart = () => {
          state.isRecording = true;
          updateRecordingButtons();
          setStatus(
            "TRANSMITINDO E GRAVANDO"
          );
        };

        state.mediaRecorder.onstop = () => {
          state.isRecording = false;
          updateRecordingButtons();
          stopRecordingCanvas();
          saveRecordedVideo();
        };

        state.mediaRecorder.onerror =
          (event) => {
            console.error(
              "Erro MediaRecorder:",
              event.error
            );

            state.isRecording = false;
            updateRecordingButtons();
            stopRecordingCanvas();
          };

        state.mediaRecorder.start(1000);
      } catch (error) {
        console.error(
          "Erro ao iniciar gravação:",
          error
        );

        stopRecordingCanvas();

        alert(
          "Não foi possível iniciar a gravação."
        );
      }
    }

    function stopRecording() {
      if (
        !state.mediaRecorder ||
        state.mediaRecorder.state ===
          "inactive"
      ) {
        return;
      }

      state.mediaRecorder.stop();
    }

    async function saveRecordedVideo() {
      if (!state.recordedChunks.length) {
        return;
      }

      const mimeType =
        state.recordingMimeType ||
        "video/webm";

      const extension =
        mimeType.includes("mp4")
          ? "mp4"
          : "webm";

      const blob =
        new Blob(
          state.recordedChunks,
          {
            type: mimeType
          }
        );

      const fileName =
        `tennispro-${Date.now()}.${extension}`;

      const file =
        new File(
          [blob],
          fileName,
          {
            type: mimeType
          }
        );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file]
        })
      ) {
        try {
          await navigator.share({
            title: "Gravação da partida",
            text:
              "Vídeo gravado pelo TennisPro",
            files: [file]
          });

          return;
        } catch (_) {}
      }

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 3000);
    }

    async function connectBroadcaster() {
      const credentials =
        await getLiveKitCredentials();

      const room =
        new LivekitClient.Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            simulcast: true
          }
        });

      state.liveKitRoom = room;

      await room.connect(
        credentials.serverUrl,
        credentials.token
      );

      const tracks =
        await LivekitClient.createLocalTracks({
          audio: true,
          video: {
            facingMode: "environment",
            width: {
              ideal: 640,
              max: 854
            },
            height: {
              ideal: 360,
              max: 480
            },
            frameRate: {
              ideal: 20,
              max: 24
            }
          }
        });

      state.liveKitLocalTracks =
        tracks;

      const mediaTracks = [];

      for (const localTrack of tracks) {
        await room.localParticipant
          .publishTrack(
            localTrack,
            {
              simulcast:
                localTrack.kind ===
                LivekitClient.Track.Kind.Video
            }
          );

        if (
          localTrack.mediaStreamTrack
        ) {
          mediaTracks.push(
            localTrack.mediaStreamTrack
          );
        }

        if (
          localTrack.kind ===
          LivekitClient.Track.Kind.Video
        ) {
          localTrack.attach(videoEl);

          videoEl.muted = true;
          videoEl.autoplay = true;
          videoEl.playsInline = true;

          ensureVideoVisible();
        }
      }

      state.localStream =
        new MediaStream(mediaTracks);

      await getMatchRef().set(
        {
          streamActive: true,
          streamRole: "broadcaster",
          streamProvider: "livekit",
          liveKitRoom:
            credentials.roomName,
          liveKitBroadcasterIdentity:
            credentials.identity,
          broadcasterStartedAt:
            firebase.firestore.FieldValue
              .serverTimestamp()
        },
        { merge: true }
      );

      updateRecordingButtons();
      setStatus("TRANSMITINDO AO VIVO");
    }

    function attachLiveKitTrack(track) {
      if (!track) {
        return;
      }

      if (
        track.kind ===
        LivekitClient.Track.Kind.Video
      ) {
        try {
          track.detach();
        } catch (_) {}

        track.attach(videoEl);

        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = false;
        videoEl.removeAttribute("muted");

        ensureVideoVisible();

        videoEl.play().then(() => {
          if (btnAtivarAudio) {
            btnAtivarAudio.style.display =
              "none";
          }

          hideInitialScreen();
        }).catch(() => {
          showInitialScreen(
            "Toque na tela para iniciar a transmissão"
          );

          if (btnAtivarAudio) {
            btnAtivarAudio.style.display =
              "inline-flex";

            const label =
              btnAtivarAudio.querySelector(
                "span"
              );

            if (label) {
              label.textContent =
                "Iniciar transmissão";
            }
          }
        });

        setStatus("ASSISTINDO AO VIVO");
        return;
      }

      if (
        track.kind ===
        LivekitClient.Track.Kind.Audio
      ) {
        const audioElement =
          track.attach();

        audioElement.autoplay = true;
        audioElement.className =
          "livekit-audio-element";

        document.body.appendChild(
          audioElement
        );

        state.liveKitAudioElements.push(
          audioElement
        );

        audioElement.play().catch(() => {
          if (btnAtivarAudio) {
            btnAtivarAudio.style.display =
              "inline-flex";
          }
        });
      }
    }

    function detachLiveKitTrack(track) {
      if (!track) {
        return;
      }

      try {
        track.detach();
      } catch (_) {}

      state.liveKitAudioElements
        .forEach((element) => {
          try {
            element.remove();
          } catch (_) {}
        });

      state.liveKitAudioElements = [];
    }

    async function connectViewer() {
      const credentials =
        await getLiveKitCredentials();

      const room =
        new LivekitClient.Room({
          adaptiveStream: true,
          dynacast: true,
          autoSubscribe: true
        });

      state.liveKitRoom = room;

      room.on(
        LivekitClient.RoomEvent.TrackSubscribed,
        (track) => {
          attachLiveKitTrack(track);
        }
      );

      room.on(
        LivekitClient.RoomEvent.TrackUnsubscribed,
        (track) => {
          detachLiveKitTrack(track);
        }
      );

      room.on(
        LivekitClient.RoomEvent.ConnectionStateChanged,
        (connectionState) => {
          console.log(
            "[LiveKit] Estado:",
            connectionState
          );
        }
      );

      await room.connect(
        credentials.serverUrl,
        credentials.token
      );

      for (
        const participant
        of room.remoteParticipants.values()
      ) {
        for (
          const publication
          of participant.trackPublications.values()
        ) {
          if (
            !publication.isSubscribed
          ) {
            try {
              await publication.setSubscribed(
                true
              );
            } catch (error) {
              console.error(
                "Erro ao assinar track:",
                error
              );
            }
          }

          if (publication.track) {
            attachLiveKitTrack(
              publication.track
            );
          }
        }
      }

      setStatus("ASSISTINDO AO VIVO");
    }

    async function startBroadcaster() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      setStatus(
        "CONECTANDO TRANSMISSOR..."
      );

      try {
        await connectBroadcaster();
      } catch (error) {
        console.error(error);

        logLine(
          `Erro transmissor LiveKit: ${ error?.message || error }`,
          true
        );

        setStatus(
          "ERRO AO CONECTAR TRANSMISSOR"
        );
      }
    }

    async function startViewer() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      setStatus(
        "CONECTANDO TRANSMISSÃO..."
      );

      try {
        await connectViewer();
      } catch (error) {
        console.error(error);

        logLine(
          `Erro espectador LiveKit: ${ error?.message || error }`,
          true
        );

        setStatus(
          "ERRO AO CONECTAR TRANSMISSÃO"
        );

        showInitialScreen(
          "Erro ao conectar transmissão."
        );
      }
    }

    async function stopLiveKit() {
      if (state.liveKitRoom) {
        try {
          await state.liveKitRoom.disconnect();
        } catch (_) {}

        state.liveKitRoom = null;
      }

      state.liveKitAudioElements
        .forEach((element) => {
          try {
            element.remove();
          } catch (_) {}
        });

      state.liveKitAudioElements = [];

      state.liveKitLocalTracks
        .forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });

      state.liveKitLocalTracks = [];
    }

    function stopCamera() {
      if (state.localStream) {
        state.localStream
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch (_) {}
          });
      }

      state.localStream = null;

      if (videoEl) {
        try {
          videoEl.srcObject = null;
        } catch (_) {}
      }
    }

    function disableTransmissionInterface() {
      state.transmissionEnded = true;

      document
        .querySelectorAll("button")
        .forEach((button) => {
          button.disabled = true;
          button.style.pointerEvents =
            "none";
          button.style.opacity = "0.35";
          button.style.cursor =
            "not-allowed";

          button.setAttribute(
            "aria-disabled",
            "true"
          );
        });

      if (videoEl) {
        try {
          videoEl.muted = true;
          videoEl.pause();
          videoEl.removeAttribute(
            "autoplay"
          );
          videoEl.setAttribute(
            "muted",
            ""
          );
        } catch (_) {}
      }

      state.liveKitAudioElements
        .forEach((audioElement) => {
          try {
            audioElement.muted = true;
            audioElement.pause();
            audioElement.remove();
          } catch (_) {}
        });

      state.liveKitAudioElements = [];

      if (
        state.mediaRecorder &&
        state.isRecording
      ) {
        try {
          state.mediaRecorder.stop();
        } catch (_) {}
      }

      stopRecordingCanvas();

      if (viewerStartButton) {
        viewerStartButton.disabled = true;
        viewerStartButton.style.pointerEvents =
          "none";
      }

      document.body.classList.add(
        "transmission-ended"
      );
    }

    function cleanup() {
      try {
        if (state.unsubMatch) {
          state.unsubMatch();
          state.unsubMatch = null;
        }
      } catch (_) {}

      if (state.finishTimer) {
        clearTimeout(state.finishTimer);
        state.finishTimer = null;
      }

      if (
        state.mediaRecorder &&
        state.isRecording
      ) {
        try {
          state.mediaRecorder.stop();
        } catch (_) {}
      }

      try {
        stopRecordingCanvas();
      } catch (_) {}

      try {
        stopCamera();
      } catch (_) {}

      try {
        stopLiveKit().catch(() => {});
      } catch (_) {}
    }

    function endTransmission() {
      if (state.transmissionEnded) {
        return;
      }

      disableTransmissionInterface();

      if (liveEndingMessage) {
        liveEndingMessage.style.display =
          "flex";
      }

      setStatus(
        "TRANSMISSÃO ENCERRADA"
      );

      setInfo(
        "A transmissão foi encerrada."
      );

      stopLiveKit().catch(() => {});
      stopCamera();

      if (role === "broadcaster") {
        getMatchRef()
          .set(
            {
              streamActive: false,
              streamEndedAt:
                firebase.firestore.FieldValue
                  .serverTimestamp()
            },
            { merge: true }
          )
          .catch(() => {});
      }
    }

    function startEndingCountdown(match) {
      if (
        !match ||
        state.transmissionEnded
      ) {
        return;
      }

      const status =
        String(match.status || "")
          .toLowerCase();

      const isFinished =
        status === "finished" ||
        status === "wo" ||
        status === "ret";

      if (!isFinished) {
        return;
      }

      const finishedAt =
        getTimestampDate(match.finishedAt);

      if (!finishedAt) {
        return;
      }

      const elapsed =
        Date.now() -
        finishedAt.getTime();

      const remaining = Math.max(
        0,
        5 * 60 * 1000 - elapsed
      );

      if (remaining <= 0) {
        endTransmission();
        return;
      }

      if (state.finishTimer) {
        clearTimeout(state.finishTimer);
      }

      state.finishTimer =
        setTimeout(
          endTransmission,
          remaining
        );
    }

    function listenToMatch() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      try {
        state.unsubMatch?.();
      } catch (_) {}

      state.unsubMatch =
        getMatchRef().onSnapshot(
          (snap) => {
            if (!snap.exists) {
              setStatus(
                "PARTIDA NÃO ENCONTRADA"
              );

              return;
            }

            const data = {
              id: snap.id,
              ...snap.data()
            };

            state.match = data;

            window.currentMatch = data;
            window.matchData = data;

            renderPlacar(data);
            startEndingCountdown(data);

            const status =
              String(data.status || "")
                .toLowerCase();

            if (status === "finished") {
              setStatus(
                "PARTIDA FINALIZADA"
              );
            } else if (
              status === "suspended"
            ) {
              setStatus(
                "PARTIDA SUSPENSA"
              );
            } else if (
              status === "live" &&
              role === "viewer"
            ) {
              setStatus(
                "ASSISTINDO AO VIVO"
              );
            }
          },
          (error) => {
            setStatus(
              "ERRO AO CARREGAR PARTIDA"
            );

            logLine(
              `Erro Firestore: ${ error?.message || error }`,
              true
            );
          }
        );
    }

    async function refreshViewer() {
      if (role !== "viewer") {
        return;
      }

      if (state.refreshLock) {
        return;
      }

      state.refreshLock = true;

      if (btnAtualizarTela) {
        btnAtualizarTela.disabled = true;

        const label =
          btnAtualizarTela.querySelector(
            "span"
          );

        if (label) {
          label.textContent =
            "Atualizando...";
        }
      }

      try {
        await stopLiveKit();

        if (videoEl) {
          try {
            videoEl.pause();
          } catch (_) {}

          videoEl.srcObject = null;
        }

        state.started = false;
        state.transmissionEnded = false;

        showInitialScreen(
          "Atualizando transmissão..."
        );

        await start();
      } catch (error) {
        console.error(error);

        setStatus(
          "ERRO AO ATUALIZAR TRANSMISSÃO"
        );
      } finally {
        state.refreshLock = false;

        if (btnAtualizarTela) {
          btnAtualizarTela.disabled = false;

          const label =
            btnAtualizarTela.querySelector(
              "span"
            );

          if (label) {
            label.textContent =
              "Atualizar tela";
          }
        }
      }
    }

    async function activateViewerAudio() {
      if (!videoEl) {
        return;
      }

      try {
        videoEl.muted = false;
        videoEl.removeAttribute("muted");

        await videoEl.play();

        if (btnAtivarAudio) {
          btnAtivarAudio.style.display =
            "none";
        }

        hideInitialScreen();
        setStatus("ASSISTINDO AO VIVO");
      } catch (error) {
        console.error(error);
      }
    }

    function applyFullscreenClass() {
      if (!videoWrap) return;

      videoWrap.classList.add(
        "aovivo-fullscreen"
      );

      document.body.classList.add(
        "aovivo-fullscreen-body"
      );
    }

    function removeFullscreenClass() {
      if (!videoWrap) return;

      videoWrap.classList.remove(
        "aovivo-fullscreen"
      );

      document.body.classList.remove(
        "aovivo-fullscreen-body"
      );
    }

    async function enterFullscreen() {
      if (!videoWrap) {
        return;
      }

      applyFullscreenClass();

      try {
        if (videoWrap.requestFullscreen) {
          await videoWrap.requestFullscreen();
        } else if (
          videoWrap.webkitRequestFullscreen
        ) {
          videoWrap.webkitRequestFullscreen();
        }
      } catch (error) {
        console.warn(
          "Fullscreen API bloqueada. Usando CSS:",
          error
        );
      }

      try {
        if (
          screen.orientation &&
          screen.orientation.lock
        ) {
          await screen.orientation.lock(
            "any"
          );
        }
      } catch (_) {}
    }

    async function exitFullscreen() {
      removeFullscreenClass();

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (
          document.webkitFullscreenElement
        ) {
          document.webkitExitFullscreen();
        }
      } catch (_) {}

      try {
        if (
          screen.orientation &&
          screen.orientation.unlock
        ) {
          screen.orientation.unlock();
        }
      } catch (_) {}
    }

    async function toggleFullscreen() {
      const cssFullscreen =
        videoWrap &&
        videoWrap.classList.contains(
          "aovivo-fullscreen"
        );

      const browserFullscreen =
        document.fullscreenElement ||
        document.webkitFullscreenElement;

      if (
        cssFullscreen ||
        browserFullscreen
      ) {
        await exitFullscreen();
      } else {
        await enterFullscreen();
      }
    }

    async function start() {
      if (state.started) {
        return;
      }

      state.started = true;

      showInitialScreen();
      updateRecordingButtons();
      listenToMatch();

      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      if (role === "broadcaster") {
        await startBroadcaster();
      } else {
        await startViewer();
      }
    }

    async function retryStart() {
      state.started = false;
      state.transmissionEnded = false;

      await stopLiveKit();

      if (videoEl) {
        videoEl.srcObject = null;
      }

      if (liveEndingMessage) {
        liveEndingMessage.style.display =
          "none";
      }

      await start();
    }

    if (btnAbrirCamera) {
      btnAbrirCamera.style.display =
        role === "broadcaster"
          ? "inline-flex"
          : "none";

      if (role === "broadcaster") {
        btnAbrirCamera.addEventListener(
          "click",
          startBroadcaster
        );
      }
    }

    if (btnIniciarGravacao) {
      btnIniciarGravacao.addEventListener(
        "click",
        startRecording
      );
    }

    if (btnPararGravacao) {
      btnPararGravacao.addEventListener(
        "click",
        stopRecording
      );
    }

    if (btnAtivarAudio) {
      btnAtivarAudio.style.display =
        "none";

      btnAtivarAudio.addEventListener(
        "click",
        activateViewerAudio
      );
    }

    if (btnAtualizarTela) {
      btnAtualizarTela.style.display =
        role === "viewer"
          ? "inline-flex"
          : "none";

      btnAtualizarTela.addEventListener(
        "click",
        refreshViewer
      );
    }

    if (btnExpandirTela) {
      btnExpandirTela.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleFullscreen();
        }
      );
    }

    if (btnTentarNovamente) {
      btnTentarNovamente.addEventListener(
        "click",
        retryStart
      );
    }

    if (videoWrap) {
      videoWrap.addEventListener(
        "click",
        async (event) => {
          if (
            event.target.closest("button")
          ) {
            return;
          }

          if (
            role === "viewer" &&
            videoEl &&
            videoEl.srcObject
          ) {
            await activateViewerAudio();
          }

          const isFullscreen =
            document.fullscreenElement ||
            document.webkitFullscreenElement;

          if (isFullscreen) {
            await exitFullscreen();
          }
        }
      );
    }

    document.addEventListener(
      "fullscreenchange",
      () => {
        if (
          !document.fullscreenElement &&
          videoWrap &&
          videoWrap.classList.contains(
            "aovivo-fullscreen"
          )
        ) {
          removeFullscreenClass();
        }
      }
    );

    window.addEventListener(
      "beforeunload",
      cleanup
    );

    setInfo(
      role === "broadcaster"
        ? "Modo transmissor"
        : "Modo espectador"
    );

    await start();
  }
});
