import type {Durations} from './core.mjs';
export type PlanId = 'free' | 'kitten' | 'scholar';
export type Feature = 'customize' | 'rooms' | 'mixer' | 'reports' | 'together';
export const PLANS: Record<PlanId, {name: string; rank: number; price: number}> = {
  free: {name:'Study Buddy', rank:0, price:0},
  kitten: {name:'Study Kitten', rank:1, price:59},
  scholar: {name:'Scholar Cat', rank:2, price:99}
};
export const FEATURES: Record<Feature, number> = {customize:1, rooms:1, mixer:1, reports:2, together:2};
export const ROOM_IDS = ['sunset','garden','rain','lavender','night','cream'] as const;
export type RoomId = typeof ROOM_IDS[number];
export function isRoomId(value: unknown): value is RoomId { return ROOM_IDS.includes(value as RoomId); }
export interface Room {name: string; room: RoomId; durations: Durations}
// Membership record returned by the account API.
export interface Member {plan?: PlanId; subscriptionId?: string; status?: string; checkoutPlan?: PlanId; paidUntil?: string | number; cancelAtEnd?: boolean; refreshPending?: boolean}
export interface FocusRow {day: string; subject: string; seconds: number}
export function hasFeature(plan: string, feature: Feature): boolean { return (PLANS[plan as PlanId]?.rank ?? 0) >= (FEATURES[feature] ?? Infinity); }
// Accepts untrusted stored or remote values.
export function cleanRoom(value: any): Room | null {
  if (!value || !isRoomId(value.room)) return null;
  const durations = value.durations;
  if (!durations || !(['focus','short','long'] as const).every(p => Number.isInteger(durations[p]) && durations[p] >= 1 && durations[p] <= 180)) return null;
  return {name:String(value.name || 'My cozy room').trim().slice(0,40),room:value.room,durations:{focus:durations.focus,short:durations.short,long:durations.long}};
}
export function addFocus(history: FocusRow[], {day,subject,seconds}: {day: string; subject?: string; seconds: number}): FocusRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 10800) return history;
  subject = String(subject || 'General').trim().slice(0,40) || 'General';
  const next = history.slice(-2000).map(row => ({...row}));
  const row = next.find(row => row.day === day && row.subject === subject);
  if (row) row.seconds += seconds; else next.push({day,subject,seconds});
  return next.slice(-2000);
}
