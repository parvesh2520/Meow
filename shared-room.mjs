export function inviteCode(value){
 const text=String(value||'').trim();
 if(/^[a-f0-9]{32}$/i.test(text))return text.toLowerCase();
 try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol))return null;const code=new URLSearchParams(url.hash.slice(1)).get('room');return /^[a-f0-9]{32}$/i.test(code||'')?code.toLowerCase():null;}catch{return null;}
}

export function sharedTimerState(room,receivedAt=Date.now()){
 const timer=room?.timer;if(!timer||!['focus','short','long'].includes(timer.phase)||!Number.isInteger(timer.seconds)||timer.seconds<0||timer.seconds>10800)return null;
 // Translate the server deadline to this device's clock instead of trusting its clock setting.
 const deadline=timer.running&&Number.isFinite(timer.endsAt)&&Number.isFinite(room.serverNow)?receivedAt+timer.endsAt-room.serverNow:null;
 const seconds=deadline===null?timer.seconds:Math.max(0,Math.ceil((deadline-receivedAt)/1000));
 return {phase:timer.phase,seconds,running:!!timer.running&&seconds>0,deadline,durations:timer.durations};
}
