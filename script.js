// ===========================
// CONFIGURATION
// ===========================
const OPENAI_API_KEY = "sk-YOUR_API_KEY_HERE";  // Replace with your own API key
const MODEL = "gpt-4o-mini"; // Change to your model

// ===========================
// DOM ELEMENTS
// ===========================
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");
const outputDiv = document.getElementById("output");

// ===========================
// AUDIO + STATE
// ===========================
let mediaRecorder, mediaStream;
let chunks = [];
let listening = false;

// ===========================
// BUTTON EVENTS
// ===========================
startButton.onclick = startConversation;
stopButton.onclick = stopConversation;

// ===========================
// MAIN FUNCTIONS
// ===========================
async function startConversation() {
  if (!OPENAI_API_KEY.startsWith("sk-")) {
    alert("Please insert your OpenAI API key in script.js");
    return;
  }

  startButton.disabled = true;
  stopButton.disabled = false;
  statusDiv.textContent = "Listening...";
  listening = true;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = async e => {
      if (e.data.size > 0 && listening) await processChunk(e.data);
    };

    mediaRecorder.start(1000); // every 1s send chunk
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Microphone access denied.";
  }
}

async function processChunk(blob) {
  const formData = new FormData();
  formData.append("file", blob, "speech.webm");
  formData.append("model", "whisper-1");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData
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
    statusDiv.textContent = "Error during transcription.";
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
        { role: "system", content: "You are an AI that automatically translates and responds conversationally in the same language you hear." },
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
  utter.lang = "auto"; // browser decides language
  utter.rate = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function stopConversation() {
  listening = false;
  startButton.disabled = false;
  stopButton.disabled = true;
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
