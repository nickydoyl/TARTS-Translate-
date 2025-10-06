// Frontend: ChatGPT-like voice chat (press to start/stop) using your Cloudflare Worker
const WORKER_WS = "wss://noisy-glade-a9eb.nickydoyl.workers.dev"; // <— your worker URL

const micBtn = document.getElementById("mic");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let ws = null;
let micStream = null;
let mediaRecorder = null;

// Simple speaker
const speaker = new Audio();
speaker.autoplay = true;

function log(...args){
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  logEl.textContent += `[${new Date().toLocaleTimeString()}] ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(...args);
}
function setStatus(t){ statusEl.textContent = t; }

async function start(){
  try{
    setStatus("Connecting…");
    log("Opening WebSocket to", WORKER_WS);
    ws = new WebSocket(WORKER_WS);
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      log("WS connected");
      // get mic
      try{
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log("Mic permission granted");
      }catch(err){
        setStatus("Mic permission denied");
        log("getUserMedia error:", err.message);
        return stop();
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      try{
        mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
        log("MediaRecorder created", mime || "(default)");
      }catch(err){
        log("MediaRecorder failed:", err.message);
        setStatus("MediaRecorder not supported");
        return stop();
      }

      mediaRecorder.ondataavailable = (e) => {
        if(e.data && e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN){
          e.data.arrayBuffer().then(buf => ws.send(buf)).catch(err => log("send error:", err));
        }
      };
      mediaRecorder.start(200);
      micBtn.classList.add("live");
      setStatus("Listening…");
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        // treat as audio (mp3/opus). Audio MIME can vary; using generic blob works across browsers.
        const blob = new Blob([evt.data], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        speaker.src = url;
        log("Audio chunk", blob.size, "bytes");
      } else {
        log("Message", evt.data);
      }
    };

    ws.onerror = (e) => { log("WS error", e.message || e); setStatus("WebSocket error"); };
    ws.onclose = () => { log("WS closed"); cleanup(); setStatus("Disconnected"); micBtn.classList.remove("live"); };

  }catch(err){
    log("Start error:", err.message);
    setStatus("Failed to start");
    cleanup();
  }
}

function cleanup(){
  try { if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop(); } catch {}
  mediaRecorder = null;
  try { if(micStream) micStream.getTracks().forEach(t => t.stop()); } catch {}
  micStream = null;
  try { if(ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch {}
  ws = null;
}

function stop(){
  cleanup();
  micBtn.classList.remove("live");
  setStatus("Stopped");
}

micBtn.addEventListener("click", () => {
  if (micBtn.classList.contains("live")) stop();
  else start();
});

// Boot
log("✅ script loaded");
setStatus("Tap to talk");
