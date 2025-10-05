// CONFIGURATION
const OPENAI_API_KEY = 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; // Replace with your own key
const MODEL = "gpt-4o-mini";

// ELEMENTS
const toggleButton = document.getElementById("toggleButton");
const visualizer = document.getElementById("visualizer");
const ctx = visualizer.getContext("2d");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");

let mediaRecorder, mediaStream, audioContext, analyser, dataArray;
let listening = false;

// Toggle Start/Stop
toggleButton.onclick = () => {
  if (listening) stopConversation();
  else startConversation();
};

// MAIN
async function startConversation() {
  if (!OPENAI_API_KEY.startsWith("sk-")) {
    alert("Please add your OpenAI API key in script.js");
    return;
  }

  toggleButton.textContent = "Stop";
  statusDiv.textContent = "Listening...";
  listening = true;
  playBeep();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);
    visualize();

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });
    mediaRecorder.ondataavailable = async e => {
      if (e.data.size > 0 && listening) await processChunk(e.data);
    };
    mediaRecorder.start(1000);
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Microphone access denied.";
  }
}

function playBeep() {
  const beepCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = beepCtx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  oscillator.connect(beepCtx.destination);
  oscillator.start();
  oscillator.stop(beepCtx.currentTime + 0.15);
}

function visualize() {
  if (!analyser || !listening) return;
  requestAnimationFrame(visualize);
  analyser.getByteTimeDomainData(dataArray);

  const style = getComputedStyle(document.body);
  const bg = style.getPropertyValue('--bg-light') || '#f5f5f7';
  const accent = style.getPropertyValue('--accent') || '#007aff';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, visualizer.width, visualizer.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent.trim();
  ctx.beginPath();

  const sliceWidth = visualizer.width / dataArray.length;
  let x = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * visualizer.height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(visualizer.width, visualizer.height / 2);
  ctx.stroke();
}

// PROCESS AUDIO
async function processChunk(blob) {
  const formData = new FormData();
  formData.append("file", blob, "speech.webm");
  formData.append("model", "whisper-1");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    const data = await response.json();
    const text = data.text?.trim();
    if (!text) return;

    addMessage("user", text);
    const reply = await askAI(text);
    addMessage("ai", reply);
    speak(reply);
  } catch (error) {
    console.error(error);
    addMessage("ai", "⚠️ Error during transcription or connection.");
  }
}

async function askAI(prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a friendly conversational AI. Translate and respond naturally." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "(no reply)";
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "auto";
  utter.rate = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function stopConversation() {
  listening = false;
  toggleButton.textContent = "Start";
  statusDiv.textContent = "Stopped.";
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
}

function addMessage(type, text) {
  const msg = document.createElement("div");
  msg.className = `message ${type}`;
  msg.textContent = text;
  outputDiv.appendChild(msg);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}
