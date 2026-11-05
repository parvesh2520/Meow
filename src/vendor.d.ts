// The Firebase SDK is loaded from Google's CDN at runtime; these declare only the surface this site uses.
declare module 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js' {
  export interface FirebaseApp {}
  export function initializeApp(config: object): FirebaseApp;
}
declare module 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js' {
  import type {FirebaseApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
  export interface User {email: string | null; getIdToken(): Promise<string>}
  export interface Auth {currentUser: User | null; authStateReady(): Promise<void>}
  export interface Persistence {}
  export class GoogleAuthProvider {setCustomParameters(params: Record<string, string>): this}
  export const browserLocalPersistence: Persistence;
  export function getAuth(app: FirebaseApp): Auth;
  export function setPersistence(auth: Auth, persistence: Persistence): Promise<void>;
  export function signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<unknown>;
  export function signOut(auth: Auth): Promise<void>;
}

interface RazorpayOptions {
  key: string; subscription_id: string; name: string; description: string;
  prefill: {email?: string | null}; theme: {color: string};
  handler(response: Record<string, string>): void;
  modal: {ondismiss(): void};
}
interface Window {
  Razorpay?: new (options: RazorpayOptions) => {on(event: 'payment.failed', handler: (response: unknown) => void): void; open(): void};
}
