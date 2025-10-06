const WORKER_WS = "wss://square-waterfall-2c5d.nickydoyl.workers.dev"; // Worker endpoint

const micBtn = document.getElementById("mic");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

let ws = null;
let micStream = null;
let mediaRecorder = null;
const speaker = new Audio();
speaker.autoplay = true;

function log(...args){
  const msg = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  logEl.textContent += line;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

function setStatus(t){ statusEl.textContent = t; }

async function startConversation(){
  log("---- Starting Conversation ----");
  setStatus("Connecting to worker...");
  try{
    ws = new WebSocket(WORKER_WS);
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      log("[WS] Connected");
      setStatus("Connected. Requesting microphone...");
      try{
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log("[Mic] Permission granted, stream active");
      }catch(err){
        log("[Mic] Error: " + err.message);
        setStatus("Microphone error");
        return stopConversation();
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      try{
        mediaRecorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
        log("[Recorder] Created successfully with " + (mime || "default") + " format");
      }catch(err){
        log("[Recorder] Failed: " + err.message);
        setStatus("Recorder not supported");
        return stopConversation();
      }

      mediaRecorder.ondataavailable = (evt) => {
        if(evt.data.size > 0 && ws.readyState === WebSocket.OPEN){
          evt.data.arrayBuffer().then(buf => ws.send(buf)).catch(e => log("[Send] Error: " + e.message));
        }
      };
      mediaRecorder.start(200);
      micBtn.classList.add("listening");
      setStatus("🎧 Listening...");
    };

    ws.onmessage = (evt) => {
      if(evt.data instanceof ArrayBuffer){
        const blob = new Blob([evt.data], { type: "audio/mpeg" });
        speaker.src = URL.createObjectURL(blob);
        log("[WS] Received audio data (" + blob.size + " bytes)");
      }else{
        log("[WS] Message: " + evt.data);
      }
    };

    ws.onerror = (e) => { log("[WS] Error: " + e.message); setStatus("WebSocket error"); };
    ws.onclose = (e) => { log("[WS] Closed, code " + e.code); setStatus("Disconnected"); micBtn.classList.remove("listening"); cleanup(); };

  }catch(err){
    log("[Fatal] " + err.message);
    setStatus("Connection failed");
  }
}

function stopConversation(){
  log("---- Stopping ----");
  if(mediaRecorder && mediaRecorder.state !== "inactive"){ mediaRecorder.stop(); }
  if(micStream){ micStream.getTracks().forEach(t => t.stop()); }
  if(ws && ws.readyState === WebSocket.OPEN){ ws.close(); }
  micBtn.classList.remove("listening");
  setStatus("Stopped");
}

function cleanup(){
  try{ if(mediaRecorder) mediaRecorder.stop(); }catch{}
  try{ if(micStream) micStream.getTracks().forEach(t => t.stop()); }catch{}
  ws = null; mediaRecorder = null; micStream = null;
}

micBtn.addEventListener("click", () => {
  if(micBtn.classList.contains("listening")) stopConversation();
  else startConversation();
});

window.addEventListener("error", (e)=>log("[WindowError] " + e.message));
log("Ready. Click mic to begin.");
