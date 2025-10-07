document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("toggleBtn");
  const logBox = document.getElementById("logBox");
  const status = document.getElementById("status");

  // Embedded simple tones
  const ding = new Audio("data:audio/mp3;base64,//uQxAAAAAAAAAAAA...");
  const buzz = new Audio("data:audio/mp3;base64,//uQxAAAAAAAAAAAA...");

  function log(msg, type = "info") {
    const time = new Date().toLocaleTimeString();
    const color = type === "error" ? "#ff7777" : "#7fff7f";
    const line = document.createElement("div");
    line.style.color = color;
    line.textContent = `[${time}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  btn.addEventListener("click", async () => {
    log("🎤 Button clicked – starting test");
    ding.play();
    status.textContent = "Connecting...";
    try {
      const ws = new WebSocket("wss://broad-hat-1325.nickydoyl.workers.dev");
      ws.onopen = () => {
        log("✅ WebSocket connected to Worker");
        status.textContent = "Connected";
      };
      ws.onmessage = (e) => log(`📩 ${e.data}`);
      ws.onerror = (err) => {
        buzz.play();
        log(`❌ WebSocket error: ${err.message}`, "error");
        status.textContent = "Error";
      };
      ws.onclose = (e) => {
        buzz.play();
        log(`🔒 Connection closed (${e.code})`);
        status.textContent = "Closed";
      };
    } catch (err) {
      buzz.play();
      log(`💥 Fatal: ${err.message}`, "error");
      status.textContent = "Failed";
    }
  });
});