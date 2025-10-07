const logDiv = document.getElementById('log');
const btn = document.getElementById('testButton');
let pressCount = 0;

function log(msg){
  const t = new Date().toLocaleTimeString();
  logDiv.innerHTML += `[${t}] ${msg}<br>`;
  logDiv.scrollTop = logDiv.scrollHeight;
}

btn.addEventListener('click', () => {
  pressCount++;
  log(`Button pressed ${pressCount} time(s). Running test scenario...`);

  try {
    const ws = new WebSocket('wss://broad-hat-1325.nickydoyl.workers.dev');
    ws.onopen = () => log('✅ WebSocket opened successfully.');
    ws.onerror = e => log('❌ WebSocket error: ' + (e.message || JSON.stringify(e)));
    ws.onclose = e => log(`🔒 Closed (code=${e.code}, reason=${e.reason || 'none'})`);
  } catch (err) {
    log('🚫 Error creating WebSocket: ' + err.message);
  }

  log('Test scenario executed.');
});
