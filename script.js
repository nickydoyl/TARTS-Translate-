const button = document.getElementById("recordButton");
const status = document.getElementById("status");
const output = document.getElementById("output");

let recorder, chunks = [], recording = false;

button.addEventListener("click", async () => {
  if (!recording) {
    recording = true;
    status.textContent = "🎙️ Recording...";
    chunks = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        status.textContent = "⏳ Processing audio...";
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        try {
          const response = await fetch("https://tight-fire-bddf.nickydoyl.workers.dev", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o-mini-transcribe",
              input: base64Audio
            })
          });

          const data = await response.json();
          output.textContent = JSON.stringify(data, null, 2);
          status.textContent = "✅ Done";
        } catch (err) {
          status.textContent = "❌ API Error";
          output.textContent = err.message;
        }
      };

      recorder.start();
      status.textContent = "🎤 Recording... Tap again to stop.";
    } catch (err) {
      status.textContent = "❌ Microphone access denied.";
      console.error(err);
    }
  } else {
    recording = false;
    status.textContent = "🛑 Stopped.";
    recorder.stop();
  }
});
