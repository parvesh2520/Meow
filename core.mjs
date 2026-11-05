export const PHASES = ['focus', 'short', 'long'];
export function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
export function remaining(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function nextPhase(phase, completed) {
  return phase === 'focus' ? (completed % 4 === 0 ? 'long' : 'short') : 'focus';
}
export function validMinutes(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 180;
}
export function studyActivity(elapsed, offset = 0) {
  return (Math.floor(Math.max(0, elapsed) / 60) + offset) % 6;
}
export function cleanKittenName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';
}
