import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,browserLocalPersistence,setPersistence} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

export interface FirebaseSession {readonly user: {email: string | null} | null; token(): Promise<string> | undefined; signIn(): Promise<unknown>; signOut(): Promise<void>}
export async function createFirebaseSession(config: object): Promise<FirebaseSession>{
 const auth=getAuth(initializeApp(config));
 await setPersistence(auth,browserLocalPersistence);
 await auth.authStateReady();
 const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 return {get user(){return auth.currentUser;},token:()=>auth.currentUser?.getIdToken(),signIn:()=>signInWithPopup(auth,provider),signOut:()=>signOut(auth)};
}
