import {PLANS,type PlanId,type Member} from './membership.mjs';

export function authErrorText(error: any): string{
 const messages: Record<string, string>={
  'auth/popup-blocked':'Your browser blocked Google sign-in. Allow popups for this site, then tap Continue with Google again.',
  'auth/popup-closed-by-user':'Google sign-in was closed. Your selected plan is kept; you can try again.',
  'auth/cancelled-popup-request':'A Google sign-in is already open. Finish it before trying again.',
  'auth/network-request-failed':'Google sign-in could not connect. Check your connection and try again.',
  'auth/unauthorized-domain':'Google sign-in is not configured for this address. Please use studywithcat.online.',
  'auth/web-storage-unsupported':'Your browser is blocking sign-in storage. Open studywithcat.online in your regular browser and allow site storage.',
  'auth/operation-not-supported-in-this-environment':'Open studywithcat.online in Chrome or Safari to sign in. Some in-app browsers cannot open Google sign-in.'
 };
 return messages[error?.code]||'Google sign-in could not finish. Try again, or open studywithcat.online in Chrome or Safari if you are inside another app.';
}

export async function loginAndRefresh<M>(client: {signIn(): Promise<unknown>},{refreshSession,refreshMember}: {refreshSession(): Promise<void>; refreshMember(): Promise<M>}): Promise<{member: M | null; membershipError: unknown}>{
 // Invoke the popup before any await, while the button tap still counts as a user gesture.
 await client.signIn();
 try{await refreshSession();return {member:await refreshMember(),membershipError:null};}
 catch(membershipError){return {member:null,membershipError};}
}

export function checkoutButtonState(key: PlanId,{ready,busy,plan,member}: {ready: boolean | null; busy: boolean; plan: PlanId; member: Member}): {disabled: boolean; label: string}{
 if(busy)return {disabled:true,label:'Opening checkout…'};
 if(plan!=='free')return {disabled:false,label:plan===key?'Current plan · My account':'Manage membership'};
 if(!ready)return {disabled:true,label:ready===null?'Connecting…':'Checkout unavailable'};
 const unfinished=member?.subscriptionId&&!['cancelled','completed','expired','none'].includes(member.status as string);
 if(unfinished)return {disabled:false,label:member.checkoutPlan===key?`Resume ${PLANS[key].name}`:`Choose ${PLANS[key].name}`};
 return {disabled:false,label:`Choose ${PLANS[key].name}`};
}
