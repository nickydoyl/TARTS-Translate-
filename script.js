// Final front-end (WebSocket streaming) wired to your Worker
const WORKER_WS = "wss://noisy-glade-a9eb.nickydoyl.workers.dev";

const micBtn = document.getElementById("mic");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const diag = document.getElementById("diag");
const debugToggle = document.getElementById("debugToggle");
const banner = document.getElementById("banner");
const bannerText = document.getElementById("bannerText");
const bannerClose = document.getElementById("bannerClose");

let ws = null;
let micStream = null;
let mediaRecorder = null;
let sentChunks = 0;
let recvChunks = 0;

const micStat = document.getElementById("micStat");
const wsStat = document.getElementById("wsStat");
const sentN = document.getElementById("sentN");
const recvN = document.getElementById("recvN");

const speaker = new Audio();
speaker.autoplay = true;

function showBanner(text){
  if (!banner || !bannerText) return;
  bannerText.textContent = text;
  banner.classList.remove("hidden");
}
bannerClose?.addEventListener("click", ()=>banner.classList.add("hidden"));

function log(...args){
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  const ts = new Date().toLocaleTimeString();
  if (logEl) {
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }
  console.log(...args);
}
function setStatus(s){ if (statusEl) statusEl.textContent = s; }

function diagUpdate(){
  if (micStat) micStat.textContent = mediaRecorder ? (mediaRecorder.state || "active") : (micStream ? "streaming" : "idle");
  if (wsStat) wsStat.textContent = ws ? ["connecting","open","closing","closed"][ws.readyState] : "closed";
  if (sentN) sentN.textContent = String(sentChunks);
  if (recvN) recvN.textContent = String(recvChunks);
}

async function start(){
  try{
    setStatus("Connecting…");
    ws = new WebSocket(WORKER_WS);
    ws.binaryType = "arraybuffer";
    diagUpdate();

    ws.onopen = async () => {
      log("[WS] connected:", WORKER_WS);
      diagUpdate();

      try{
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log("[Mic] permission granted");
      }catch(err){
        log("[Mic] denied:", err?.message || err);
        setStatus("Microphone blocked");
        showBanner("Microphone permission denied");
        return stop();
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      try{
        mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
        log("[Recorder] started with", mime || "(default)");
      }catch(err){
        log("[Recorder] failed:", err?.message || err);
        showBanner("Your browser doesn't support MediaRecorder");
        setStatus("Recorder unsupported");
        return stop();
      }

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        e.data.arrayBuffer()
          .then(buf => { ws.send(buf); sentChunks++; diagUpdate(); })
          .catch(err=>log("[Send] error:", err));
      };
      mediaRecorder.start(200);

      micBtn.classList.add("live");
      setStatus("Listening…");
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        const blob = new Blob([evt.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        speaker.src = url;
        recvChunks++; diagUpdate();
        log("[WS] audio", blob.size, "bytes");
      } else {
        log("[WS] text", evt.data);
      }
    };

    ws.onerror = (e) => {
      log("[WS] error", e?.message || e);
      showBanner("Connection error. Check Worker WS support.");
      setStatus("Error");
      diagUpdate();
    };

    ws.onclose = () => {
      log("[WS] closed");
      setStatus("Disconnected");
      micBtn.classList.remove("live");
      cleanup();
      diagUpdate();
    };
  }catch(err){
    log("[Fatal] start error:", err?.message || err);
    showBanner("Start failed: " + (err?.message || err));
    setStatus("Failed");
    cleanup();
    diagUpdate();
  }
}

function cleanup(){
  try{ if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop(); }catch{}
  mediaRecorder = null;
  try{ if (micStream) micStream.getTracks().forEach(t=>t.stop()); }catch{}
  micStream = null;
  try{ if (ws && ws.readyState === WebSocket.OPEN) ws.close(); }catch{}
  ws = null;
}

function stop(){
  cleanup();
  micBtn.classList.remove("live");
  setStatus("Stopped");
  diagUpdate();
}

micBtn.addEventListener("click", ()=>{
  if (micBtn.classList.contains("live")) stop();
  else start();
});

debugToggle.addEventListener("click", ()=>{
  diag.classList.toggle("hidden");
});

// boot
log("✅ script loaded");
setStatus("Tap to talk");
diagUpdate();
