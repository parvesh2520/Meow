export const PHASES = ['focus', 'short', 'long'] as const;
export type Phase = typeof PHASES[number];
export type Durations = Record<Phase, number>;
export function isPhase(value: unknown): value is Phase {
  return PHASES.includes(value as Phase);
}
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}
export function remaining(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function nextPhase(phase: Phase, completed: number): Phase {
  return phase === 'focus' ? (completed % 4 === 0 ? 'long' : 'short') : 'focus';
}
export function validMinutes(value: unknown): boolean {
  return Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 180;
}
export function studyActivity(elapsed: number, offset = 0): number {
  return (Math.floor(Math.max(0, elapsed) / 60) + offset) % 6;
}
export function cleanKittenName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';
}
