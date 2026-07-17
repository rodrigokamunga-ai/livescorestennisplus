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
  
      window.__db = db;
      window.firebaseAppReady = true;
  
      const params = new URLSearchParams(window.location.search);
      const matchId = String(params.get("id") || "").trim();
      const role = String(params.get("role") || "viewer").trim().toLowerCase();
      let shareToken = String(params.get("shareToken") || "").trim();
  
      const videoEl = document.getElementById("liveVideo");
      const videoWrap = document.getElementById("videoWrap");
      const btnAbrirCamera = document.getElementById("btnAbrirCamera");
      const btnExpandirTela = document.getElementById("btnExpandirTela");
      const btnTentarNovamente = document.getElementById("btnTentarNovamente");
      const cameraStatus = document.getElementById("cameraStatus");
      const cameraDebug = document.getElementById("cameraDebug");
      const tvStatus = document.getElementById("tvStatus");
      const tvInfoBox = document.getElementById("tvInfoBox");
      const telaInicial = document.getElementById("telaInicial");
      const tvGridPlacar = document.getElementById("tvGridPlacar");
      const liveEndingMessage = document.getElementById("liveEndingMessage");
  
      const state = {
        match: null,
        localStream: null,
        broadcasterPcMap: new Map(),
        viewerPc: null,
        peerId: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        unsubMatch: null,
        unsubPeers: null,
        unsubPeerDoc: null,
        unsubCandidateListeners: new Map(),
        started: false,
        transmissionEnded: false,
        finishTimer: null
      };
  
      const iceServers = [
        { urls: "stun:stun.l.google.com:19302" }
      ];
  
      function injectCompactScoreboardStyles() {
        if (document.getElementById("aovivoCompactScoreStyles")) {
          return;
        }
  
        const style = document.createElement("style");
        style.id = "aovivoCompactScoreStyles";
  
        style.textContent = ` .aovivo-compact-scoreboard { display: flex; flex-direction: column; gap: 1px; width: min(100%, 390px); padding: 5px 7px; border-radius: 6px; background: rgba(0, 0, 0, 0.68); color: #fff; backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28); box-sizing: border-box; } .aovivo-compact-row { display: grid; align-items: center; gap: 1px; min-height: 20px; width: 100%; line-height: 1; } .aovivo-compact-name { display: flex; align-items: center; min-width: 0; width: 100%; overflow: hidden; white-space: nowrap; } .aovivo-compact-serve { width: 7px; height: 7px; flex: 0 0 7px; margin-right: 4px; border-radius: 50%; background: #d8ff63; box-shadow: 0 0 6px rgba(216, 255, 99, 0.9); } .aovivo-compact-serve.hidden { visibility: hidden; } .aovivo-compact-player { display: block; min-width: 0; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; line-height: 1; font-weight: 800; } .aovivo-compact-number { min-width: 18px; text-align: center; font-size: 12px; line-height: 1; font-weight: 900; color: #fff; } .aovivo-compact-number.current { color: #d8ff63; } .aovivo-compact-number.empty { visibility: hidden; } .aovivo-compact-score-set { display: inline-flex; align-items: flex-start; justify-content: center; white-space: nowrap; } .aovivo-compact-score-main { line-height: 1; } .aovivo-compact-score-tb { position: relative; top: -0.42em; margin-left: 1px; font-size: 0.58em; line-height: 1; } #videoWrap:fullscreen { width: 100vw; height: 100vh; aspect-ratio: auto; border: 0; border-radius: 0; background: #000; } #videoWrap:fullscreen #liveVideo { width: 100vw; height: 100vh; object-fit: contain; } #videoWrap:fullscreen .live-public-scoreboard { left: 3vw; bottom: 3vh; width: min(94vw, 560px); } @media (max-width: 768px) { .aovivo-compact-scoreboard { width: min(100%, 330px); padding: 4px 6px; } .aovivo-compact-row { gap: 1px; min-height: 18px; } .aovivo-compact-player { font-size: 9px; } .aovivo-compact-number { min-width: 16px; font-size: 11px; } .aovivo-compact-serve { width: 6px; height: 6px; flex-basis: 6px; margin-right: 3px; } } @media (max-width: 480px) { .aovivo-compact-scoreboard { width: min(100%, 285px); padding: 4px 5px; } .aovivo-compact-player { font-size: 8px; } .aovivo-compact-number { min-width: 15px; font-size: 10px; } } `;
  
        document.head.appendChild(style);
      }
  
      function escapeHtml(value = "") {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
  
      function logLine(message, isError = false) {
        const line = `[${new Date().toLocaleTimeString("pt-BR")}] ${message}`;
  
        console[isError ? "error" : "log"](line);
  
        [cameraStatus, cameraDebug].forEach((target) => {
          if (!target) {
            return;
          }
  
          const div = document.createElement("div");
          div.textContent = line;
          div.style.cssText = ` font-size: 12px; line-height: 1.35; margin-top: 4px; color: ${isError ? "#ffb4b4" : "#fff"}; white-space: pre-wrap; `;
  
          target.appendChild(div);
        });
      }
  
      function resetDebugBoxes() {
        if (cameraStatus) {
          cameraStatus.innerHTML = "";
        }
  
        if (cameraDebug) {
          cameraDebug.innerHTML = "";
        }
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
  
      function showInitialScreen(text = "Aguardando vídeo...") {
        if (telaInicial) {
          telaInicial.textContent = text;
          telaInicial.style.display = "flex";
        }
      }
  
      function hideInitialScreen() {
        if (telaInicial) {
          telaInicial.style.display = "none";
        }
      }
  
      function ensureVideoVisible() {
        if (videoEl) {
          videoEl.style.display = "block";
          videoEl.style.visibility = "visible";
          videoEl.style.opacity = "1";
          videoEl.style.zIndex = "1";
        }
  
        hideInitialScreen();
      }
  
      function showPermissionHelp() {
        if (btnTentarNovamente) {
          btnTentarNovamente.style.display = "inline-flex";
        }
      }
  
      function hidePermissionHelp() {
        if (btnTentarNovamente) {
          btnTentarNovamente.style.display = "none";
        }
      }
  
      function getTimestampDate(value) {
        if (!value) {
          return null;
        }
  
        if (value.toDate && typeof value.toDate === "function") {
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
  
          tieBreakMode:
            score.tieBreakMode === "tb7" ||
            score.tieBreakMode === "super10"
              ? score.tieBreakMode
              : null,
  
          tieBreakPoints1: Number(score.tieBreakPoints1 || 0),
          tieBreakPoints2: Number(score.tieBreakPoints2 || 0),
  
          lastTieBreakMode:
            score.lastTieBreakMode === "tb7" ||
            score.lastTieBreakMode === "super10"
              ? score.lastTieBreakMode
              : null,
  
          lastTieBreakPoints1: Number(score.lastTieBreakPoints1 || 0),
          lastTieBreakPoints2: Number(score.lastTieBreakPoints2 || 0),
  
          setHistory: Array.isArray(score.setHistory)
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
            p1: String(score.lastTieBreakPoints1 || 0),
            p2: String(score.lastTieBreakPoints2 || 0)
          };
        }
  
        const format = String(matchFormat || "").toLowerCase();
  
        const noAd =
          format.includes("sem vantagem") ||
          format.includes("no ad") ||
          format.includes("no-ad");
  
        const hasAdvantage =
          format.includes("com vantagem") ||
          format.includes("3 sets");
  
        const points1 = Number(score.points1 || 0);
        const points2 = Number(score.points2 || 0);
  
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
  
        if (noAd && points1 === 3 && points2 === 3) {
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
        const gameFormat = String(match.gameFormat || "").trim();
  
        return (
          gameFormat === "Duplas" ||
          gameFormat === "Duplas Mistas"
        );
      }
  
      function getPlayerNames(match) {
        const player1 = String(match.player1 || "Jogador A").trim();
        const player2 = String(match.player2 || "Jogador B").trim();
  
        if (!isDoubles(match)) {
          return {
            player1,
            player2
          };
        }
  
        const player3 = String(match.player3 || "Jogador C").trim();
        const player4 = String(match.player4 || "Jogador D").trim();
  
        return {
          player1: `${player1}/${player2}`,
          player2: `${player3}/${player4}`
        };
      }
  
      function getSetScoreValue( setData, playerPosition, isCompleted = true ) {
        if (!setData) {
          return "";
        }
  
        const gamesKey =
          playerPosition === 1
            ? "games1"
            : "games2";
  
        const tieBreakKey =
          playerPosition === 1
            ? "tieBreakPoints1"
            : "tieBreakPoints2";
  
        const games = Number(
          setData[gamesKey] || 0
        );
  
        const tieBreakMode =
          setData.tieBreakMode === "tb7" ||
          setData.tieBreakMode === "super10";
  
        if (!tieBreakMode) {
          return String(games);
        }
  
        const tieBreakPoints1 = Number(
          setData.tieBreakPoints1 || 0
        );
  
        const tieBreakPoints2 = Number(
          setData.tieBreakPoints2 || 0
        );
  
        if (setData.tieBreakMode === "super10") {
          return String(
            playerPosition === 1
              ? tieBreakPoints1
              : tieBreakPoints2
          );
        }
  
        let finalGames1 = 6;
        let finalGames2 = 6;
  
        if (
          isCompleted &&
          (
            tieBreakPoints1 > 0 ||
            tieBreakPoints2 > 0
          )
        ) {
          if (tieBreakPoints1 > tieBreakPoints2) {
            finalGames1 = 7;
            finalGames2 = 6;
          } else if (
            tieBreakPoints2 > tieBreakPoints1
          ) {
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
            playerPosition === 1
              ? tieBreakPoints1
              : tieBreakPoints2
          )
        };
      }
  
      function getVisibleSetCount(match, score) {
        const history = Array.isArray(score.setHistory)
          ? score.setHistory
          : [];
  
        const status = String(match.status || "").toLowerCase();
  
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
        const history = Array.isArray(score.setHistory)
          ? score.setHistory
          : [];
  
        const status = String(match.status || "").toLowerCase();
  
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
                ? String(score.tieBreakPoints1 || 0)
                : String(score.tieBreakPoints2 || 0)
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
                  ? String(score.tieBreakPoints1 || 0)
                  : String(score.tieBreakPoints2 || 0)
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
          return ` <span class="aovivo-compact-number empty"></span> `;
        }
  
        if (typeof value === "object") {
          return ` <span class="aovivo-compact-number ${ isCurrent ? "current" : "" }"> <span class="aovivo-compact-score-set"> <span class="aovivo-compact-score-main"> ${escapeHtml(value.main)} </span> <span class="aovivo-compact-score-tb"> ${escapeHtml(value.tieBreak)} </span> </span> </span> `;
        }
  
        return ` <span class="aovivo-compact-number ${ isCurrent ? "current" : "" }"> ${escapeHtml(String(value))} </span> `;
      }
  
      function renderCompactPlayerRow( match, score, playerPosition, pointDisplay, visibleSetCount, isFinished ) {
        const names = getPlayerNames(match);
  
        const playerName =
          playerPosition === 1
            ? names.player1
            : names.player2;
  
        const setValues = getSetValues(
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
  
        const scoreColumns = Array.from(
          {
            length: visibleSetCount
          },
          () => "21px"
        ).join(" ");
  
        const columns = showPoints
          ? ` minmax(0, 1fr) ${scoreColumns} 26px `
          : ` minmax(0, 1fr) ${scoreColumns} `;
  
        const server = score.server || "player1";
  
        const isServing =
          playerPosition === 1
            ? server === "player1"
            : server === "player2";
  
        const pointValue =
          playerPosition === 1
            ? pointDisplay.p1
            : pointDisplay.p2;
  
        return ` <div class="aovivo-compact-row" style="grid-template-columns: ${columns};" > <div class="aovivo-compact-name"> <span class="aovivo-compact-serve ${ isServing ? "" : "hidden" }" ></span> <span class="aovivo-compact-player"> ${escapeHtml(playerName)} </span> </div> ${setMarkup.join("")} ${ showPoints ? ` <span class="aovivo-compact-number current"> ${escapeHtml(pointValue)} </span> ` : "" } </div> `;
      }
  
      function renderPlacar(match) {
        if (!match || !tvGridPlacar) {
          return;
        }
  
        const score = normalizeScore(match.score || {});
  
        const status = String(match.status || "").toLowerCase();
  
        const isFinished =
          status === "finished" ||
          status === "wo" ||
          status === "ret";
  
        const pointDisplay = getPointDisplay(
          score,
          match.matchFormat,
          isFinished
        );
  
        const visibleSetCount =
          getVisibleSetCount(match, score);
  
        tvGridPlacar.innerHTML = ` <div class="aovivo-compact-scoreboard"> ${renderCompactPlayerRow( match, score, 1, pointDisplay, visibleSetCount, isFinished )} ${renderCompactPlayerRow( match, score, 2, pointDisplay, visibleSetCount, isFinished )} </div> `;
      }
  
      function stopCamera() {
        if (
          state.localStream &&
          typeof state.localStream.getTracks ===
            "function"
        ) {
          state.localStream.getTracks().forEach((track) => {
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
  
      function stopWebRtc() {
        state.broadcasterPcMap.forEach((pc) => {
          try {
            pc.close();
          } catch (_) {}
        });
  
        state.broadcasterPcMap.clear();
  
        state.unsubCandidateListeners.forEach((unsubscribe) => {
          try {
            unsubscribe();
          } catch (_) {}
        });
  
        state.unsubCandidateListeners.clear();
  
        if (state.viewerPc) {
          try {
            state.viewerPc.close();
          } catch (_) {}
  
          state.viewerPc = null;
        }
      }
  
      function cleanup() {
        try {
          state.unsubMatch?.();
        } catch (_) {}
  
        try {
          state.unsubPeers?.();
        } catch (_) {}
  
        try {
          state.unsubPeerDoc?.();
        } catch (_) {}
  
        state.unsubMatch = null;
        state.unsubPeers = null;
        state.unsubPeerDoc = null;
  
        if (state.finishTimer) {
          clearTimeout(state.finishTimer);
          state.finishTimer = null;
        }
  
        stopWebRtc();
        stopCamera();
      }
  
      async function fetchMatchAndToken() {
        try {
          const snap = await getMatchRef().get();
  
          if (!snap.exists) {
            return null;
          }
  
          const data = snap.data() || {};
  
          if (!shareToken && data.shareToken) {
            shareToken = String(data.shareToken || "").trim();
          }
  
          return data;
        } catch (error) {
          logLine(
            `Erro ao buscar partida: ${ error?.message || error }`,
            true
          );
  
          return null;
        }
      }
  
      async function createBroadcasterPeer(viewerId) {
        if (state.broadcasterPcMap.has(viewerId)) {
          return;
        }
  
        const pc = new RTCPeerConnection({
          iceServers
        });
  
        state.broadcasterPcMap.set(viewerId, pc);
  
        if (state.localStream) {
          state.localStream.getTracks().forEach((track) => {
            pc.addTrack(track, state.localStream);
          });
        }
  
        pc.onicecandidate = async (event) => {
          if (!event.candidate) {
            return;
          }
  
          try {
            await getPeerCandidatesCol(viewerId).add({
              side: "broadcaster",
              candidate: event.candidate.toJSON(),
              ts: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            logLine(
              `Erro ICE broadcaster: ${ error?.message || error }`,
              true
            );
          }
        };
  
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            getPeerDoc(viewerId)
              .set(
                {
                  status: "connected",
                  updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
                },
                { merge: true }
              )
              .catch(() => {});
          }
        };
  
        const offer = await pc.createOffer();
  
        await pc.setLocalDescription(offer);
  
        await getPeerDoc(viewerId).set(
          {
            role: "viewer",
            status: "offered",
            peerUid: viewerId,
            shareToken,
            broadcasterPeerId: state.peerId,
            offer: {
              type: offer.type,
              sdp: offer.sdp
            },
            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
  
        const unsubscribePeer = getPeerDoc(viewerId).onSnapshot(
          async (snap) => {
            const data = snap.data() || {};
  
            if (
              data.answer &&
              !pc.currentRemoteDescription
            ) {
              try {
                await pc.setRemoteDescription(
                  new RTCSessionDescription(data.answer)
                );
  
                await getPeerDoc(viewerId).set(
                  {
                    status: "answered",
                    updatedAt:
                      firebase.firestore.FieldValue.serverTimestamp()
                  },
                  { merge: true }
                );
              } catch (error) {
                logLine(
                  `Erro ao aplicar answer: ${ error?.message || error }`,
                  true
                );
              }
            }
          }
        );
  
        const unsubscribeCandidates =
          getPeerCandidatesCol(viewerId).onSnapshot(
            (snapshot) => {
              snapshot.docChanges().forEach(async (change) => {
                if (change.type !== "added") {
                  return;
                }
  
                const data = change.doc.data();
  
                if (
                  !data?.candidate ||
                  data.side !== "viewer"
                ) {
                  return;
                }
  
                try {
                  await pc.addIceCandidate(
                    new RTCIceCandidate(data.candidate)
                  );
                } catch (error) {
                  logLine(
                    `Erro ao adicionar ICE: ${ error?.message || error }`,
                    true
                  );
                }
              });
            }
          );
  
        state.unsubCandidateListeners.set(
          `peer-${viewerId}-doc`,
          unsubscribePeer
        );
  
        state.unsubCandidateListeners.set(
          `peer-${viewerId}-cand`,
          unsubscribeCandidates
        );
      }
  
      async function startBroadcaster() {
        if (!matchId) {
          setStatus("SEM ID DE PARTIDA");
          return;
        }
  
        const matchData = await fetchMatchAndToken();
  
        if (
          !matchData ||
          matchData.shareEnabled !== true
        ) {
          setStatus("PARTIDA NÃO DISPONÍVEL");
          return;
        }
  
        if (!shareToken) {
          setStatus("SEM SHARE TOKEN");
          return;
        }
  
        hidePermissionHelp();
  
        setStatus("ABRINDO CÂMERA...");
        setInfo("Modo transmissor");
  
        try {
          state.localStream =
            await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: {
                  ideal: "environment"
                },
                width: {
                  ideal: 1280
                },
                height: {
                  ideal: 720
                }
              },
              audio: false
            });
        } catch (_) {
          try {
            state.localStream =
              await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
              });
          } catch (error) {
            setStatus("CÂMERA INDISPONÍVEL");
  
            logLine(
              `Erro câmera: ${ error?.name || "Erro" } - ${ error?.message || error }`,
              true
            );
  
            if (
              String(error?.name || "") ===
              "NotAllowedError"
            ) {
              showPermissionHelp();
            }
  
            return;
          }
        }
  
        if (videoEl) {
          videoEl.srcObject = state.localStream;
          videoEl.muted = true;
          videoEl.playsInline = true;
  
          try {
            await videoEl.play();
          } catch (_) {}
        }
  
        ensureVideoVisible();
  
        await getMatchRef().set(
          {
            streamActive: true,
            streamRole: "broadcaster",
            broadcasterPeerId: state.peerId,
            broadcasterStartedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
  
        setStatus("TRANSMITINDO AO VIVO");
  
        state.unsubPeers =
          getPeersCol().onSnapshot(
            (snapshot) => {
              snapshot.docChanges().forEach(
                (change) => {
                  const viewerId = change.doc.id;
                  const data = change.doc.data() || {};
  
                  if (data.role !== "viewer") {
                    return;
                  }
  
                  const validChange =
                    change.type === "added" ||
                    change.type === "modified";
  
                  const validStatus =
                    data.status === "requesting" ||
                    data.status === "answered";
  
                  if (
                    validChange &&
                    validStatus &&
                    !state.broadcasterPcMap.has(viewerId)
                  ) {
                    createBroadcasterPeer(viewerId)
                      .catch((error) => {
                        logLine(
                          `Erro ao criar peer: ${ error?.message || error }`,
                          true
                        );
                      });
                  }
                }
              );
            }
          );
      }
  
      async function startViewer() {
        if (!matchId) {
          setStatus("SEM ID DE PARTIDA");
          return;
        }
  
        const matchData = await fetchMatchAndToken();
  
        if (
          !matchData ||
          matchData.shareEnabled !== true
        ) {
          setStatus("PARTIDA NÃO DISPONÍVEL");
          return;
        }
  
        if (!shareToken) {
          setStatus("SEM SHARE TOKEN");
          return;
        }
  
        setStatus("CONECTANDO TRANSMISSÃO...");
        setInfo("Modo espectador");
  
        const myPeerId = state.peerId;
        const myPeerRef = getPeerDoc(myPeerId);
        const myCandidatesRef = getPeerCandidatesCol(myPeerId);
  
        await myPeerRef.set(
          {
            role: "viewer",
            status: "requesting",
            peerUid: myPeerId,
            shareToken,
            createdAt:
              firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt:
              firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
  
        const pc = new RTCPeerConnection({
          iceServers
        });
  
        state.viewerPc = pc;
  
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
  
          if (videoEl) {
            videoEl.srcObject = remoteStream;
            videoEl.muted = true;
            videoEl.playsInline = true;
  
            videoEl.play().catch(() => {});
          }
  
          ensureVideoVisible();
          setStatus("ASSISTINDO AO VIVO");
        };
  
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            setStatus("ERRO NA CONEXÃO");
          }
  
          if (pc.connectionState === "disconnected") {
            setStatus("TRANSMISSÃO DESCONECTADA");
          }
        };
  
        pc.onicecandidate = async (event) => {
          if (!event.candidate) {
            return;
          }
  
          try {
            await myCandidatesRef.add({
              side: "viewer",
              candidate: event.candidate.toJSON(),
              ts:
                firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            logLine(
              `Erro ICE viewer: ${ error?.message || error }`,
              true
            );
          }
        };
  
        const unsubscribePeer =
          myPeerRef.onSnapshot(
            async (snap) => {
              const data = snap.data() || {};
  
              if (
                data.offer &&
                !pc.currentRemoteDescription
              ) {
                try {
                  await pc.setRemoteDescription(
                    new RTCSessionDescription(data.offer)
                  );
  
                  const answer =
                    await pc.createAnswer();
  
                  await pc.setLocalDescription(answer);
  
                  await myPeerRef.set(
                    {
                      role: "viewer",
                      status: "answered",
                      peerUid: myPeerId,
                      shareToken,
                      answer: {
                        type: answer.type,
                        sdp: answer.sdp
                      },
                      updatedAt:
                        firebase.firestore.FieldValue
                          .serverTimestamp()
                    },
                    { merge: true }
                  );
                } catch (error) {
                  logLine(
                    `Erro viewer offer/answer: ${ error?.message || error }`,
                    true
                  );
  
                  setStatus("ERRO NA CONEXÃO");
                }
              }
            }
          );
  
        const unsubscribeCandidates =
          myCandidatesRef.onSnapshot(
            (snapshot) => {
              snapshot.docChanges().forEach(
                async (change) => {
                  if (change.type !== "added") {
                    return;
                  }
  
                  const data = change.doc.data();
  
                  if (
                    !data?.candidate ||
                    data.side !== "broadcaster"
                  ) {
                    return;
                  }
  
                  try {
                    await pc.addIceCandidate(
                      new RTCIceCandidate(data.candidate)
                    );
                  } catch (error) {
                    logLine(
                      `Erro ao adicionar ICE: ${ error?.message || error }`,
                      true
                    );
                  }
                }
              );
            }
          );
  
        state.unsubPeerDoc = unsubscribePeer;
  
        state.unsubCandidateListeners.set(
          `viewer-${myPeerId}`,
          unsubscribeCandidates
        );
      }
  
      function endTransmission() {
        if (state.transmissionEnded) {
          return;
        }
  
        state.transmissionEnded = true;
  
        if (liveEndingMessage) {
          liveEndingMessage.style.display = "flex";
        }
  
        setStatus("TRANSMISSÃO ENCERRADA");
  
        stopWebRtc();
  
        if (role === "broadcaster") {
          stopCamera();
  
          getMatchRef()
            .set(
              {
                streamActive: false,
                streamEndedAt:
                  firebase.firestore.FieldValue.serverTimestamp()
              },
              { merge: true }
            )
            .catch(() => {});
        } else if (videoEl) {
          try {
            videoEl.pause();
          } catch (_) {}
        }
      }
  
      function startEndingCountdown(match) {
        if (!match || state.transmissionEnded) {
          return;
        }
  
        const status = String(match.status || "").toLowerCase();
  
        const isFinished =
          status === "finished" ||
          status === "wo" ||
          status === "ret";
  
        if (!isFinished) {
          if (state.finishTimer) {
            clearTimeout(state.finishTimer);
            state.finishTimer = null;
          }
  
          return;
        }
  
        const finishedAt =
          getTimestampDate(match.finishedAt);
  
        if (!finishedAt) {
          return;
        }
  
        const elapsed =
          Date.now() - finishedAt.getTime();
  
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
  
        state.finishTimer = setTimeout(
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
                setStatus("PARTIDA NÃO ENCONTRADA");
                return;
              }
  
              const data = {
                id: snap.id,
                ...snap.data()
              };
  
              state.match = data;
  
              window.currentMatch = data;
              window.matchData = data;
              window.currentShareToken =
                String(
                  data.shareToken ||
                    shareToken ||
                    ""
                ).trim();
  
              renderPlacar(data);
              startEndingCountdown(data);
  
              const status = String(
                data.status || ""
              ).toLowerCase();
  
              if (status === "finished") {
                setStatus("PARTIDA FINALIZADA");
              } else if (status === "suspended") {
                setStatus("PARTIDA SUSPENSA");
              } else if (
                status === "live" &&
                role === "viewer"
              ) {
                setStatus("ASSISTINDO AO VIVO");
              }
            },
            (error) => {
              setStatus("ERRO AO CARREGAR PARTIDA");
  
              logLine(
                `Erro Firestore match: ${ error?.message || error }`,
                true
              );
            }
          );
      }
  
      async function enterFullscreen() {
        if (!videoWrap) {
          return;
        }
  
        try {
          if (videoWrap.requestFullscreen) {
            await videoWrap.requestFullscreen();
          } else if (
            videoWrap.webkitRequestFullscreen
          ) {
            videoWrap.webkitRequestFullscreen();
          }
        } catch (error) {
          logLine(
            `Não foi possível expandir a tela: ${ error?.message || error }`,
            true
          );
        }
      }
  
      async function exitFullscreen() {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else if (
            document.webkitFullscreenElement
          ) {
            document.webkitExitFullscreen();
          }
        } catch (_) {}
      }
  
      async function toggleFullscreen() {
        const isFullscreen =
          document.fullscreenElement ||
          document.webkitFullscreenElement;
  
        if (isFullscreen) {
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
  
        resetDebugBoxes();
        injectCompactScoreboardStyles();
        showInitialScreen();
  
        listenToMatch();
  
        if (!matchId) {
          setStatus("SEM ID DE PARTIDA");
          return;
        }
  
        await fetchMatchAndToken();
  
        logLine(`Iniciando como ${role}`);
        logLine(`matchId: ${matchId}`);
        logLine(
          `shareToken: ${ shareToken ? "OK" : "AUSENTE" }`
        );
  
        if (role === "broadcaster") {
          await startBroadcaster();
        } else {
          await startViewer();
        }
      }
  
      async function retryStart() {
        state.started = false;
        state.transmissionEnded = false;
  
        cleanup();
  
        if (liveEndingMessage) {
          liveEndingMessage.style.display = "none";
        }
  
        await start();
      }
  
      if (btnAbrirCamera) {
        if (role === "viewer") {
          btnAbrirCamera.style.display = "none";
        } else {
          btnAbrirCamera.style.display = "inline-flex";
  
          btnAbrirCamera.addEventListener(
            "click",
            startBroadcaster
          );
        }
      }
  
      if (btnExpandirTela) {
        btnExpandirTela.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();
            toggleFullscreen();
          }
        );
      }
  
      if (videoWrap) {
        videoWrap.addEventListener(
          "click",
          async (event) => {
            if (event.target.closest("button")) {
              return;
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
  
      if (btnTentarNovamente) {
        btnTentarNovamente.addEventListener(
          "click",
          retryStart
        );
      }
  
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
