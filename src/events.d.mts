// Window events that connect the free desk (app) with the cat club (club). Payloads are still validated at runtime.
import type {Phase, Durations} from './core.mjs';
import type {CatStyle} from './companions.mjs';
import type {Room, RoomId} from './membership.mjs';
import type {SharedTimerState} from './shared-room.mjs';

export interface StudySnapshot {room: RoomId; durations: Durations; kittenName: string; phase: Phase; seconds: number; deadline: number | null}

declare global {
  interface WindowEventMap {
    'study-focus': CustomEvent<{seconds: number; day: string; subject: string}>;
    'study-notice': CustomEvent<string>;
    'cat-reaction': CustomEvent<{frame?: number; event?: string}>;
    'cat-style-change': CustomEvent<CatStyle>;
    'study-room-restore': CustomEvent<Room>;
    'study-shared-timer': CustomEvent<SharedTimerState>;
    'study-shared-mode': CustomEvent<boolean>;
    'study-shared-active': CustomEvent<boolean>;
    'study-snapshot': CustomEvent<StudySnapshot>;
    'study-snapshot-request': Event;
    'study-timer-change': Event;
  }
}
