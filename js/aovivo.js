// =========================================================================
// MOTOR DE CARREGAMENTO SEGURO CONTRA CONFLITO DE FILAS (TENNISPRO TV)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM totalmente carregado. Aguardando injeção do Firebase...");
  
    // Inicia um loop de verificação em background até a Google injetar a palavra 'firebase'
    const checarFirebasePronto = setInterval(() => {
      if (typeof firebase !== "undefined") {
        clearInterval(checarFirebasePronto);
        inicializarPlacarTelevisao();
      }
    }, 50); // Testa a cada 50 milissegundos de forma silenciosa
  
    function inicializarPlacarTelevisao() {
      console.log("Firebase detectado! Inicializando credenciais da quadra...");
  
      const firebaseConfig = {
        apiKey: "AIzaSyBngwZh3oErADZoTFG6AOqj6QLzwv1R6qY",
        authDomain: "://firebaseapp.com",
        projectId: "live-scores-tennis-plus",
        storageBucket: "live-scores-tennis-plus.firebasestorage.app",
        messagingSenderId: "949079557619",
        appId: "1:949079557619:web:d1715339815c28d971be86",
        measurementId: "G-NDT9YVW4C6"
      };
  
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
  
      // Vincula obrigatoriamente no objeto global do navegador
      window.__auth = firebase.auth();
      window.__db = firebase.firestore();
      window.firebaseAppReady = true;
  
      const videoElement = document.getElementById('liveVideo');
      const params = new URLSearchParams(window.location.search);
      const matchId = params.get("id");
  
      let localTimer = null;
      let liveStartedAtMs = null;
  
      // 1. INICIALIZA A CÂMERA TRASEIRA NO PLANO DE FUNDO
      async function ligarCameraTraseira() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: 1920, height: 1080 },
            audio: false
          });
          if (videoElement) videoElement.srcObject = stream;
        } catch (error) {
          console.error("Erro ao acessar hardware da câmera traseira:", error);
        }
      }
      ligarCameraTraseira();
  
      // 2. FUNÇÕES DE TRATAMENTO DE REGRAS DE NEGÓCIO CLONADAS DO PUBLIC.JS
      function getGameFormat(match) {
        return String(match?.gameFormat || "Simples").trim();
      }
  
      function isDoublesFormat(match) {
        return getGameFormat(match) === "Duplas" || getGameFormat(match) === "Duplas Mistas";
      }
  
      function renderPlayerNameTV(match, which) {
        const doubles = isDoublesFormat(match);
        if (!doubles) {
          return which === 1
            ? String(match.player1 || "Jogador 1").trim()
            : String(match.player2 || "Jogador 2").trim();
        }
        const p1 = which === 1 ? String(match.player1 || "Jogador 1").trim() : String(match.player3 || "Jogador 3").trim();
        const p2 = which === 1 ? String(match.player2 || "Jogador 2").trim() : String(match.player4 || "Jogador 4").trim();
        return `${p1}/${p2}`;
      }
  
      function durationText(ms) {
        const s = Math.floor(ms / 1000);
        const h = String(Math.floor(s / 3600)).padStart(2, "0");
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
        const sec = String(s % 60).padStart(2, "0");
        return `${h}:${m}:${sec}`;
      }
  
      function mapStatus(status) {
        switch (status) {
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
        return new Date(value);
      }
  
      function buildDurationLocal(match) {
        const accumulated = Number(match.accumulatedSeconds || 0);
        if (match.status === "suspended") return durationText(accumulated * 1000);
        if (match.status === "live") {
          const started = toDateLocal(match.startedAt);
          if (started && !isNaN(started.getTime())) {
            const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
            return durationText((accumulated + elapsed) * 1000);
          }
          return durationText(accumulated * 1000);
        }
        if (match.durationSeconds && Number(match.durationSeconds) > 0) return durationText(Number(match.durationSeconds) * 1000);
        return "00:00:00";
      }
  
      function getSetColumnsLocal(match, score) {
        const history = Array.isArray(score.setHistory) ? score.setHistory : [];
        function formatSet(setObj) {
          if (!setObj) return { p1: "0", p2: "0" };
          const g1 = Number(setObj.games1 ?? 0);
          const g2 = Number(setObj.games2 ?? 0);
          const tb1 = Number(setObj.tieBreakPoints1 ?? 0);
          const tb2 = Number(setObj.tieBreakPoints2 ?? 0);
          if (setObj.tieBreakMode === "tb7" || setObj.tieBreakMode === "super10") {
            if (tb1 > 0 || tb2 > 0) return { p1: String(tb1 > tb2 ? 7 : 6), p2: String(tb1 > tb2 ? 6 : 7), tb1: tb1 > tb2 ? tb1 : 0, tb2: tb2 > tb1 ? tb2 : 0 };
          }
          return { p1: String(g1), p2: String(g2), tb1: 0, tb2: 0 };
        }
        const setsTratados = [];
        for (let i = 0; i < 3; i++) {
          if (history[i]) setsTratados.push(formatSet(history[i]));
          else if (history.length === i) setsTratados.push({ p1: String(score.games1 ?? 0), p2: String(score.games2 ?? 0), tb1: 0, tb2: 0 });
        }
        return setsTratados;
      }
    // 3. CANAL DE ESCUTA REATIVO EM TEMPO REAL NO FIRESTORE
    const idTratado = String(matchId || "").trim();

    if (idTratado && idTratado !== "null" && window.__db) {
      console.log("Escuta síncrona iniciada para a partida ID:", idTratado);

      window.__db.collection("matches").doc(idTratado).onSnapshot((doc) => {
        try {
          if (!doc.exists) {
            console.warn("Aviso: Documento não existe no Firestore para o ID:", idTratado);
            return;
          }

          const data = doc.data();
          const score = normalizeScoreLocal(data.score || {});
          const fmt = data.matchFormat || "";

          // SINCRO DOS NOMES: Aplica a formatação do seu renderPlayerName
          const elName1 = document.getElementById("tvName1");
          const elName2 = document.getElementById("tvName2");
          if (elName1) elName1.innerText = renderPlayerNameTV(data, 1).toUpperCase();
          if (elName2) elName2.innerText = renderPlayerNameTV(data, 2).toUpperCase();

          // Sincroniza os games do set atual
          const elGame1 = document.getElementById("tvGame1");
          const elGame2 = document.getElementById("tvGame2");
          if (elGame1) elGame1.innerText = score.games1 ?? "0";
          if (elGame2) elGame2.innerText = score.games2 ?? "0";

          // Altera o rótulo do cabeçalho da transmissão (Status)
          const labelStatus = document.getElementById("tvStatus");
          const isTBActive = score.tieBreakMode === "tb7" || score.tieBreakMode === "super10";
          const isTBFinished = data.status === "finished" && !score.tieBreakMode && !!score.lastTieBreakMode;

          if (labelStatus) {
            if (score.tieBreakMode === "super10" && data.status === "live") labelStatus.innerText = "SUPER TIE-BREAK";
            else if (score.tieBreakMode === "tb7" && data.status === "live") labelStatus.innerText = "TIE-BREAK";
            else labelStatus.innerText = mapStatus(data.status);
          }

          // RESOLVE O PLACAR DE PONTOS TRADUZIDOS DA FUNÇÃO GETPOINTDISPLAYTV
          const ptDisp = getPointDisplayTV(score, data.matchFormat, data.status === "finished");
          
          const elPoints1 = document.getElementById("tvPoints1");
          const elPoints2 = document.getElementById("tvPoints2");
          if (elPoints1) elPoints1.innerText = ptDisp.p1;
          if (elPoints2) elPoints2.innerText = ptDisp.p2;

          // Controle de tempo reativo da Transmissão (buildDurationLocal)
          const durationEl = document.getElementById("tvDuration");
          if (durationEl) {
            clearInterval(localTimer);
            localTimer = null;

            if (data.status === "live") {
              const updateClock = () => {
                if (durationEl) durationEl.textContent = buildDurationLocal(data);
              };
              updateClock();
              localTimer = setInterval(updateClock, 1000);
            } else {
              durationEl.textContent = buildDurationLocal(data);
            }
          }

          // Sincronização do Indicador de Saque (//)
          const sacadorAtual = score.server || data.server || "player1";
          const elServe1 = document.getElementById("tvServe1");
          const elServe2 = document.getElementById("tvServe2");
          if (elServe1) elServe1.innerText = sacadorAtual === "player1" ? "//" : "";
          if (elServe2) elServe2.innerText = sacadorAtual === "player2" ? "//" : "";

          // PROCESSAMENTO DOS SETS ANTERIORES BASEADOS NO SEU ARRANJO DE HISTÓRICO
          for (let i = 0; i < 3; i++) {
            const box1 = document.getElementById(`tvSet1_${i}`);
            const box2 = document.getElementById(`tvSet2_${i}`);
            if (box1) box1.style.display = "none";
            if (box2) box2.style.display = "none";
          }

          const historicoSets = getSetColumnsLocal(data, score);

          historicoSets.forEach((setObj, index) => {
            if (index < 3) {
              const elBox1 = document.getElementById(`tvSet1_${index}`);
              const elBox2 = document.getElementById(`tvSet2_${index}`);

              if (elBox1 && elBox2) {
                const nSet1 = elBox1.querySelector(".nSet");
                const nSet2 = elBox2.querySelector(".nSet");
                const nTB1 = elBox1.querySelector(".nTB");
                const nTB2 = elBox2.querySelector(".nTB");

                if (nSet1) nSet1.innerText = setObj.p1;
                if (nSet2) nSet2.innerText = setObj.p2;

                if (nTB1) nTB1.innerText = setObj.tb1 > 0 ? String(setObj.tb1) : "";
                if (nTB2) nTB2.innerText = setObj.tb2 > 0 ? String(setObj.tb2) : "";

                elBox1.style.display = "table-cell";
                elBox2.style.display = "table-cell";
              }
            }
          });

          // 4. LOGICA DE ALERTA DE BREAK POINT / PONTO DECISIVO (NO-AD)
          const badgeAlerta = document.getElementById("badgeAlerta");
          if (badgeAlerta) {
            const fmtTexto = String(data.matchFormat || "").toLowerCase();
            const isNoAd = fmtTexto.includes("sem vantagem") || fmtTexto.includes("no ad") || fmtTexto.includes("no-ad");
            const hasAd = fmtTexto.includes("com vantagem") || fmtTexto.includes("3 sets");
            
            const sp = sacadorAtual === "player1" ? score.points1 : score.points2;
            const rp = sacadorAtual === "player1" ? score.points2 : score.points1;

            let exibeAlerta = false;
            let textoAlerta = "BREAK POINT";

            if (score.tieBreakMode === "tb7" || score.tieBreakMode === "super10") {
              exibeAlerta = false;
            } else if (isNoAd && score.points1 === 3 && score.points2 === 3) {
              exibeAlerta = true;
              textoAlerta = "PONTO DECISIVO";
            } else if (hasAd && !isNoAd && ((sacadorAtual === "player1" && score.advantage === "player2") || (sacadorAtual === "player2" && score.advantage === "player1"))) {
              exibeAlerta = true;
            } else if (rp === 3 && sp < 3) {
              exibeAlerta = true;
            }

            if (exibeAlerta) {
              badgeAlerta.innerText = score.tieBreakMode ? "MINI-BREAK" : textoAlerta;
              badgeAlerta.style.display = "block";
            } else {
              badgeAlerta.style.display = "none";
          }
        }
      } catch (innerError) {
        console.error("Erro interno ao renderizar os dados do snapshot:", innerError);
      }

    }, (error) => {
      console.error("Erro crítico na escuta real do Firestore Ao Vivo:", error);
    });
  } else {
    const labelStatus = document.getElementById("tvStatus");
    if (labelStatus) labelStatus.innerText = "SEM ID DE PARTIDA";
    console.error("Erro fatal: Parâmetro 'id' ou instância global 'window.__db' não foram encontrados.");
  }
} // FIM DA FUNÇÃO INICIALIZARPLACARTELEVISAO
}); // FIM DO DOMCONTENTLOADED
  
