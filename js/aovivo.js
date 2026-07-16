document.addEventListener("DOMContentLoaded", () => {
  const waitFirebase = setInterval(() => {
    if (typeof firebase !== "undefined") {
      clearInterval(waitFirebase);
      initApp();
    }
  }, 50);

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
    const auth = firebase.auth();

    window.__db = db;
    window.__auth = auth;
    window.firebaseAppReady = true;

    const params = new URLSearchParams(window.location.search);
    const matchId = (params.get("id") || "").trim();
    const role = (params.get("role") || "viewer").trim().toLowerCase();
    let shareToken = (params.get("shareToken") || "").trim();

    const videoEl = document.getElementById("liveVideo");
    const btnAbrirCamera = document.getElementById("btnAbrirCamera");
    const btnTentarNovamente = document.getElementById("btnTentarNovamente");
    const cameraStatus = document.getElementById("cameraStatus");
    const cameraDebug = document.getElementById("cameraDebug");
    const tvGridPlacar = document.getElementById("tvGridPlacar");
    const tvStatus = document.getElementById("tvStatus");
    const tvInfoBox = document.getElementById("tvInfoBox");
    const telaInicial = document.getElementById("telaInicial");

    const state = {
      match: null,
      localStream: null,
      viewerPc: null,
      broadcasterPcMap: new Map(),
      peerId: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      unsubMatch: null,
      unsubPeers: null,
      unsubPeerDoc: null,
      unsubCandidateListeners: new Map(),
      started: false,
      serverReady: false,
      serverStartedAt: null
    };

    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

    function logLine(msg, isError = false) {
      const line = `[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`;
      console[isError ? "error" : "log"](line);

      const style = `font-size:12px;line-height:1.35;margin-top:4px;color:${isError ? "#ffb4b4" : "#fff"};white-space:pre-wrap;`;

      if (cameraStatus) {
        const div = document.createElement("div");
        div.style.cssText = style;
        div.textContent = line;
        cameraStatus.appendChild(div);
      }

      if (cameraDebug) {
        const div = document.createElement("div");
        div.style.cssText = style;
        div.textContent = line;
        cameraDebug.appendChild(div);
      }
    }

    function resetDebugBoxes() {
      if (cameraStatus) cameraStatus.innerHTML = "";
      if (cameraDebug) cameraDebug.innerHTML = "";
    }

    function setStatus(text) {
      if (tvStatus) tvStatus.textContent = text || "";
    }

    function setInfo(text) {
      if (tvInfoBox) tvInfoBox.textContent = text || "";
    }

    function showPermissionHelp() {
      if (btnTentarNovamente) btnTentarNovamente.style.display = "inline-block";
    }

    function hidePermissionHelp() {
      if (btnTentarNovamente) btnTentarNovamente.style.display = "none";
    }

    function ensureVideoVisible() {
      if (videoEl) {
        videoEl.style.display = "block";
        videoEl.style.visibility = "visible";
        videoEl.style.opacity = "1";
        videoEl.style.zIndex = "1";
      }
      if (telaInicial) {
        telaInicial.style.display = "none";
      }
    }

    function stopCamera() {
      if (state.localStream && typeof state.localStream.getTracks === "function") {
        state.localStream.getTracks().forEach((track) => {
          try { track.stop(); } catch (_) {}
        });
      }
      state.localStream = null;

      if (videoEl) {
        try { videoEl.srcObject = null; } catch (_) {}
      }
    }

    function stopWebRtc() {
      state.broadcasterPcMap.forEach((pc) => {
        try { pc.close(); } catch (_) {}
      });
      state.broadcasterPcMap.clear();

      state.unsubCandidateListeners.forEach((unsub) => {
        try { unsub(); } catch (_) {}
      });
      state.unsubCandidateListeners.clear();

      if (state.viewerPc) {
        try { state.viewerPc.close(); } catch (_) {}
        state.viewerPc = null;
      }
    }

    function cleanup() {
      try { state.unsubMatch?.(); } catch (_) {}
      try { state.unsubPeers?.(); } catch (_) {}
      try { state.unsubPeerDoc?.(); } catch (_) {}

      state.unsubMatch = null;
      state.unsubPeers = null;
      state.unsubPeerDoc = null;

      stopWebRtc();
      stopCamera();
    }

    function getMatchRef() {
      return db.collection("matches").doc(matchId);
    }

    function getPeersCol() {
      return getMatchRef().collection("peers");
    }

    function getPeerDoc(peerId) {
      return getPeersCol().doc(peerId);
    }

    function getPeerCandidatesCol(peerId) {
      return getPeerDoc(peerId).collection("candidates");
    }

    function normalizeScore(score = {}) {
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

    function getPointDisplay(score, matchFormat, isFinished = false) {
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

      const tennisPointLabel = (points) => {
        switch (Number(points || 0)) {
          case 0: return "00";
          case 1: return "15";
          case 2: return "30";
          case 3: return "40";
          default: return "40";
        }
      };

      if (hasAd && !noAd) {
        if (score.advantage === "player1") return { p1: "AD", p2: "40" };
        if (score.advantage === "player2") return { p1: "40", p2: "AD" };
        if (p1 >= 3 && p2 >= 3) {
          if (p1 === p2) return { p1: "40", p2: "40" };
          if (p1 > p2) return { p1: "AD", p2: "40" };
          if (p2 > p1) return { p1: "40", p2: "AD" };
        }
        return { p1: tennisPointLabel(p1), p2: tennisPointLabel(p2) };
      }

      if (noAd) {
        if (p1 === 3 && p2 === 3) return { p1: "40", p2: "40" };
        return { p1: tennisPointLabel(p1), p2: tennisPointLabel(p2) };
      }

      if (score.advantage === "player1") return { p1: "AD", p2: "40" };
      if (score.advantage === "player2") return { p1: "40", p2: "AD" };

      if (p1 >= 3 && p2 >= 3) {
        if (p1 === p2) return { p1: "40", p2: "40" };
        if (p1 > p2) return { p1: "AD", p2: "40" };
        if (p2 > p1) return { p1: "40", p2: "AD" };
      }

      return { p1: tennisPointLabel(p1), p2: tennisPointLabel(p2) };
    }

    function buildMatchScoreText(data) {
      const score = normalizeScore(data.score);
      if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
        return `${score.tieBreakPoints1}x${score.tieBreakPoints2}`;
      }
      return `${score.games1}x${score.games2} - ${getPointDisplay(score, data.matchFormat).p1}x${getPointDisplay(score, data.matchFormat).p2}`;
    }

    function renderPlacar(match) {
      if (!tvGridPlacar || !match) return;
      const score = normalizeScore(match.score || {});
      const pts = getPointDisplay(score, match.matchFormat, false);

      tvGridPlacar.textContent = `${score.games1}x${score.games2} - ${pts.p1}x${pts.p2}`;
    }

    function listenToMatch() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      try { state.unsubMatch?.(); } catch (_) {}

      state.unsubMatch = getMatchRef().onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setStatus("PARTIDA NÃO ENCONTRADA");
            return;
          }

          const data = { id: snap.id, ...snap.data() };
          state.match = data;
          window.currentMatch = data;
          window.matchData = data;
          window.currentShareToken = String(data.shareToken || shareToken || "").trim();

          renderPlacar(data);
        },
        (err) => {
          setStatus("ERRO AO CARREGAR PARTIDA");
          logLine(`Erro Firestore match: ${err?.message || err}`, true);
        }
      );
    }

    async function fetchMatchAndToken() {
      const snap = await getMatchRef().get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      if (!shareToken && data.shareToken) shareToken = String(data.shareToken || "").trim();
      return data;
    }

    async function createBroadcasterPeer(viewerId) {
      if (state.broadcasterPcMap.has(viewerId)) return;

      const pc = new RTCPeerConnection({ iceServers });
      state.broadcasterPcMap.set(viewerId, pc);

      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => pc.addTrack(track, state.localStream));
      }

      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await getPeerCandidatesCol(viewerId).add({
            side: "broadcaster",
            candidate: event.candidate.toJSON(),
            ts: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (err) {
          logLine(`Erro ICE broadcaster: ${err?.message || err}`, true);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await getPeerDoc(viewerId).set({
        role: "viewer",
        status: "offered",
        peerUid: viewerId,
        shareToken: shareToken,
        broadcasterPeerId: state.peerId,
        offer: { type: offer.type, sdp: offer.sdp },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const unsubPeer = getPeerDoc(viewerId).onSnapshot(async (snap) => {
        const data = snap.data() || {};
        if (data.answer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } catch (err) {
            logLine(`Erro aplicar answer: ${err?.message || err}`, true);
          }
        }
      });

      const unsubCandidates = getPeerCandidatesCol(viewerId).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;
          const c = change.doc.data();
          if (!c?.candidate || c.side !== "viewer") return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c.candidate));
          } catch (err) {
            logLine(`Erro addIceCandidate viewer->broadcaster: ${err?.message || err}`, true);
          }
        });
      });

      state.unsubCandidateListeners.set(`peer-${viewerId}-doc`, unsubPeer);
      state.unsubCandidateListeners.set(`peer-${viewerId}-cand`, unsubCandidates);
    }

    async function startBroadcaster() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      const matchData = await fetchMatchAndToken();
      if (!matchData || matchData.shareEnabled !== true) {
        setStatus("PARTIDA NÃO DISPONÍVEL");
        logLine("shareEnabled não está true no documento da partida.", true);
        return;
      }

      if (!shareToken) {
        setStatus("SEM SHARE TOKEN");
        logLine("shareToken ausente.", true);
        return;
      }

      hidePermissionHelp();
      setStatus("ABRINDO CÂMERA...");
      logLine("Modo transmissor detectado. Abrindo câmera...");

      try {
        state.localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        try {
          state.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e2) {
          setStatus("CÂMERA INDISPONÍVEL");
          logLine(`Erro câmera: ${e2?.name || "Erro"} - ${e2?.message || e2}`, true);
          if (String(e2?.name || "") === "NotAllowedError") showPermissionHelp();
          return;
        }
      }

      if (videoEl) {
        videoEl.srcObject = state.localStream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.setAttribute("autoplay", "");
        videoEl.setAttribute("muted", "");
        videoEl.setAttribute("playsinline", "");
        try { await videoEl.play(); } catch (_) {}
      }

      ensureVideoVisible();

      await getMatchRef().set({
        streamActive: true,
        streamRole: "broadcaster",
        broadcasterPeerId: state.peerId,
        broadcasterStartedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setStatus("TRANSMITINDO AO VIVO");
      state.serverReady = true;
      state.serverStartedAt = Date.now();

      state.unsubPeers = getPeersCol().onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() || {};
          const viewerId = change.doc.id;

          if (data.role !== "viewer") return;

          if ((change.type === "added" || change.type === "modified") &&
              (data.status === "requesting" || data.status === "answered")) {
            if (!state.broadcasterPcMap.has(viewerId)) {
              createBroadcasterPeer(viewerId).catch((err) => {
                logLine(`Erro criar peer broadcaster: ${err?.message || err}`, true);
              });
            }
          }
        });
      });
    }

    async function startViewer() {
      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        return;
      }

      const matchData = await fetchMatchAndToken();
      if (!matchData || matchData.shareEnabled !== true) {
        setStatus("PARTIDA NÃO DISPONÍVEL");
        return;
      }

      if (!shareToken) {
        setStatus("SEM SHARE TOKEN");
        return;
      }

      setStatus("CONECTANDO TRANSMISSÃO...");
      logLine("Modo espectador detectado.");

      const myPeerId = state.peerId;
      const myPeerRef = getPeerDoc(myPeerId);
      const myCandidatesRef = getPeerCandidatesCol(myPeerId);

      await myPeerRef.set({
        role: "viewer",
        status: "requesting",
        peerUid: myPeerId,
        shareToken: shareToken,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const pc = new RTCPeerConnection({ iceServers });
      state.viewerPc = pc;

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (videoEl) {
          videoEl.srcObject = remoteStream;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.setAttribute("autoplay", "");
          videoEl.setAttribute("playsinline", "");
          try { videoEl.play(); } catch (_) {}
        }
        ensureVideoVisible();
        setStatus("ASSISTINDO AO VIVO");
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await myCandidatesRef.add({
            side: "viewer",
            candidate: event.candidate.toJSON(),
            ts: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (err) {
          logLine(`Erro ICE viewer: ${err?.message || err}`, true);
        }
      };

      const unsubPeer = myPeerRef.onSnapshot(async (snap) => {
        const data = snap.data() || {};
        if (data.offer && !pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await myPeerRef.set({
              role: "viewer",
              status: "answered",
              peerUid: myPeerId,
              shareToken: shareToken,
              answer: { type: answer.type, sdp: answer.sdp },
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (err) {
            logLine(`Erro viewer offer/answer: ${err?.message || err}`, true);
            setStatus("ERRO NA CONEXÃO");
          }
        }
      });

      const unsubCandidates = myCandidatesRef.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;
          const c = change.doc.data();
          if (!c?.candidate || c.side !== "broadcaster") return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c.candidate));
          } catch (err) {
            logLine(`Erro addIceCandidate broadcaster->viewer: ${err?.message || err}`, true);
          }
        });
      });

      state.unsubPeerDoc = unsubPeer;
      state.unsubCandidateListeners.set(`viewer-${myPeerId}`, unsubCandidates);
    }

    async function start() {
      if (state.started) return;
      state.started = true;

      resetDebugBoxes();
      ensureVideoVisible();
      listenToMatch();

      if (!matchId) {
        setStatus("SEM ID DE PARTIDA");
        logLine("URL inválida: matchId ausente", true);
        return;
      }

      await fetchMatchAndToken();

      logLine(`Iniciando como ${role}`);
      logLine(`matchId: ${matchId}`);
      logLine(`shareToken: ${shareToken ? "OK" : "AUSENTE"}`);

      if (role === "broadcaster") {
        await startBroadcaster();
      } else {
        await startViewer();
      }
    }

    async function retryStart() {
      state.started = false;
      cleanup();
      await start();
    }

    if (btnAbrirCamera) {
      btnAbrirCamera.addEventListener("click", startBroadcaster);
    }

    if (btnTentarNovamente) {
      btnTentarNovamente.addEventListener("click", retryStart);
    }

    window.addEventListener("beforeunload", cleanup);

    setInfo(role === "broadcaster" ? "Modo transmissor" : "Modo espectador");
    await start();
  }
});
