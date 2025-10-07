const WORKER_URL = "wss://broad-hat-1325.nickydoyl.workers.dev";
const btn = document.getElementById('toggleBtn');
const logEl = document.getElementById('log');

let ws = null, mediaRecorder = null, isRecording = false, stream = null;

function log(msg){
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  console.log(msg);
}

async function connect(){
  log('🌐 Connecting to worker...');
  ws = new WebSocket(WORKER_URL);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => log('✅ Connected to Worker');
  ws.onmessage = (e) => log('📩 Message: ' + (typeof e.data === 'string'? e.data.slice(0,160): "[binary]"));
  ws.onclose = (e) => { log(`🔒 Closed (code=${e.code})`); setTimeout(connect, 3000); };
  ws.onerror = (e) => log('❌ WebSocket error');
}

async function startRecording(){
  if (!ws || ws.readyState !== WebSocket.OPEN){
    log("⚠️ WebSocket not ready, reconnecting...");
    connect();
    setTimeout(startRecording, 1500);
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    log("🎤 Microphone started");
    mediaRecorder = new MediaRecorder(stream, { mimeType:'audio/webm' });
    const chunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type:'audio/webm' });
      const buf = await blob.arrayBuffer();
      if (ws && ws.readyState === WebSocket.OPEN){
        ws.send(buf);
        log(`📤 Sent audio (${buf.byteLength} bytes)`);
      } else {
        log("⚠️ Socket not open when sending");
      }
      stopMic();
    };
    mediaRecorder.start();
    isRecording = true;
    btn.classList.add('on');
    log("🎙️ Recording...");
  } catch(err){
    log("🚫 Mic error: " + err.message);
  }
}

function stopMic(){
  if (stream){
    stream.getTracks().forEach(t=>t.stop());
    log("🎧 Mic stopped");
    stream = null;
  }
}

function stopRecording(){
  if (mediaRecorder && isRecording){
    mediaRecorder.stop();
    isRecording = false;
    btn.classList.remove('on');
    log("🛑 Recording stopped");
  } else {
    log("ℹ️ Not recording");
  }
}

btn.addEventListener('click', ()=>{
  log("👉 Button pressed");
  if (!isRecording) startRecording();
  else stopRecording();
});

window.onload = () => {
  log("🚀 Auto connecting...");
  connect();
};
