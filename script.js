const WORKER_URL = "wss://young-frog-8de4.nickydoyl.workers.dev";
const button = document.getElementById('talkButton');
const logDiv = document.getElementById('log');
const statusDiv = document.getElementById('status');
let ws = null;
let mediaStream = null;

function log(msg) {
  console.log(msg);
  logDiv.innerHTML += `<div>> ${msg}</div>`;
}

async function startTalking() {
  try {
    log('Requesting microphone...');
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ws = new WebSocket(WORKER_URL);
    
    ws.onopen = () => {
      log('Connected to worker');
      statusDiv.textContent = 'Status: Connected';
      button.classList.add('active');
    };

    ws.onerror = (err) => log('WebSocket Error: ' + err.message);
    ws.onclose = () => {
      log('Connection closed');
      button.classList.remove('active');
      statusDiv.textContent = 'Status: Disconnected';
    };

    const audioCtx = new AudioContext({ sampleRate: 24000 });
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN) {
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
        }
        ws.send(pcm);
      }
    };
  } catch (e) {
    log('Error starting mic: ' + e.message);
  }
}

function stopTalking() {
  if (ws) ws.close();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  button.classList.remove('active');
  statusDiv.textContent = 'Status: Stopped';
}

let isTalking = false;
button.addEventListener('click', () => {
  if (!isTalking) startTalking();
  else stopTalking();
  isTalking = !isTalking;
});