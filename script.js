const WS_URL = "wss://broad-hat-1325.nickydoyl.workers.dev";
const micBtn=document.getElementById("mic");
const logBox=document.getElementById("log");
const chatBox=document.getElementById("chat");
const status=document.getElementById("status");

function log(msg){
  const t=new Date().toLocaleTimeString();
  logBox.textContent+=`[${t}] ${msg}\n`;
  logBox.scrollTop=logBox.scrollHeight;
  console.log(msg);
}
function addChat(who,text){
  const div=document.createElement("div");
  div.className=who;
  div.textContent=`${who==="user"?"🧑":"🤖"} ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop=chatBox.scrollHeight;
}

let ws, ctx, processor;
micBtn.onclick = async () => {
  log("🎤 Button pressed");
  if (ws && ws.readyState === WebSocket.OPEN){ws.close();micBtn.className="";status.textContent="Ready";return;}
  try{
    log("Requesting microphone...");
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    log("✅ Microphone granted");
    ctx=new AudioContext();
    const src=ctx.createMediaStreamSource(stream);
    processor=ctx.createScriptProcessor(4096,1,1);
    src.connect(processor);processor.connect(ctx.destination);
    log("Connecting to Worker...");status.textContent="Connecting...";
    ws=new WebSocket(WS_URL);ws.binaryType="arraybuffer";
    ws.onopen=()=>{log("✅ Connected to Worker");status.textContent="Listening";micBtn.className="listening";
      processor.onaudioprocess=e=>{
        const data=e.inputBuffer.getChannelData(0);
        const pcm=new Int16Array(data.length);
        for(let i=0;i<data.length;i++) pcm[i]=Math.max(-1,Math.min(1,data[i]))*0x7fff;
        if(ws.readyState===WebSocket.OPEN) ws.send(pcm.buffer);
      };
    };
    ws.onmessage=e=>{
      log("📨 Message from Worker: "+e.data.slice(0,80));
      try{
        const d=JSON.parse(e.data);
        if(d.user){addChat("user",d.user);}
        if(d.ai){addChat("ai",d.ai);}
      }catch{log("Non-JSON msg received");}
    };
    ws.onclose=e=>{log(`🔒 Closed: ${e.code}`);micBtn.className="";status.textContent="Ready";}
    ws.onerror=e=>{log("❌ WS error "+(e.message||""));status.textContent="Error";}
  }catch(err){log("🚫 Mic error: "+err.message);}
};