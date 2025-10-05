const micButton = document.getElementById("micButton");
const statusText = document.getElementById("status");
let ws, mediaRecorder;
let audioPlayer = new Audio();

async function startRealtime() {
  try {
    ws = new WebSocket("wss://lively-moon-5a49.nickydoyl.workers.dev");
    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      statusText.textContent = "🎙️ Connected. Speak now...";
      micButton.classList.remove("idle");
      micButton.classList.add("listening");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm; codecs=opus" });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          event.data.arrayBuffer().then(buf => ws.send(buf));
        }
      };
      mediaRecorder.start(250); // send chunks every 250ms
    };

    ws.onmessage = (event) => {
      const blob = new Blob([event.data], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      audioPlayer.src = url;
      audioPlayer.play().catch(console.error);
    };

    ws.onclose = () => {
      micButton.classList.remove("listening");
      micButton.classList.add("idle");
      statusText.textContent = "🔇 Disconnected.";
    };
  } catch (err) {
    console.error("Error starting realtime:", err);
    statusText.textContent = "❌ Failed to start: " + err.message;
  }
}

function stopRealtime() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  micButton.classList.remove("listening");
  micButton.classList.add("idle");
  statusText.textContent = "🛑 Stopped.";
}

micButton.addEventListener("click", () => {
  if (micButton.classList.contains("listening")) {
    stopRealtime();
  } else {
    startRealtime();
  }
});
