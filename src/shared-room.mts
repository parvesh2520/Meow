import {isPhase,type Phase,type Durations} from './core.mjs';
export interface SharedTimerState {phase: Phase; seconds: number; running: boolean; deadline: number | null; durations?: Durations}
export function inviteCode(value: unknown): string | null {
 const text=String(value||'').trim();
 if(/^[a-f0-9]{32}$/i.test(text))return text.toLowerCase();
 try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol))return null;const code=new URLSearchParams(url.hash.slice(1)).get('room');return code&&/^[a-f0-9]{32}$/i.test(code)?code.toLowerCase():null;}catch{return null;}
}

// Accepts the untrusted room payload from the API.
export function sharedTimerState(room: any, receivedAt=Date.now()): SharedTimerState | null {
 const timer=room?.timer;if(!timer||!isPhase(timer.phase)||!Number.isInteger(timer.seconds)||timer.seconds<0||timer.seconds>10800)return null;
 // Translate the server deadline to this device's clock instead of trusting its clock setting.
 const deadline=timer.running&&Number.isFinite(timer.endsAt)&&Number.isFinite(room.serverNow)?receivedAt+timer.endsAt-room.serverNow:null;
 const seconds=deadline===null?timer.seconds:Math.max(0,Math.ceil((deadline-receivedAt)/1000));
 return {phase:timer.phase,seconds,running:!!timer.running&&seconds>0,deadline,durations:timer.durations};
}
