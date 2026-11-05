import {clubTemplate} from './club-template.mjs';
import {PLANS,hasFeature,cleanRoom,addFocus} from './membership.mjs';
import {AmbienceMixer} from './club-audio.mjs';
import {CATS,OUTFITS,normalizeStyle,wardrobeFrame,canWear} from './companions.mjs';
import {SCENES} from './room-flow.mjs';
import {authErrorText,loginAndRefresh,checkoutButtonState} from './checkout-flow.mjs';
import {inviteCode,sharedTimerState} from './shared-room.mjs';
import {$,all} from './dom.mjs';
import {MIX_KINDS,type MixKind} from './club-audio.mjs';
import type {FirebaseSession} from './firebase-session.mjs';
import type {StudySnapshot} from './events.mjs';
import type {CatStyle,OutfitId} from './companions.mjs';
import type {PlanId,Feature,Member,Room,FocusRow} from './membership.mjs';
type Mix = Partial<Record<MixKind, number>>;
interface SavedRoom extends Room {id: string; style: CatStyle; mix: Mix}
interface ClubData {style: CatStyle; rooms: SavedRoom[]; history: FocusRow[]; goal: number; mix: Mix}
interface ClientConfig {paymentsReady?: boolean; accountsReady?: boolean; testMode?: boolean; firebaseConfig?: object}
interface Session {access_token?: string; user: {email: string | null}}
interface Group {id: string; name: string; code: string; isHost: boolean; members: {name: string; host?: boolean}[]; expiresAt?: string | number; timerRevision?: number}
class ApiError extends Error {status?: number; code?: string; existingPlan?: PlanId}
async function startClub(){
const releaseRequest=fetch('/api/study?action=config',{signal:AbortSignal.timeout(12000)}).then(async response=>{if(!response.ok)throw Error('Connection unavailable');return response.json();}).catch(()=>null);
const local=['127.0.0.1','localhost'].includes(location.hostname);
const review=local&&new URLSearchParams(location.search).get('preview')==='1';
const KEY='study-with-cat-club-v1';
let data: ClubData={style:{catId:'mochi',outfit:'none'},rooms:[],history:[],goal:120,mix:{}};
try {const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old && typeof old==='object')data={...data,...old};} catch{}
data.rooms=Array.isArray(data.rooms)?data.rooms.filter(r=>cleanRoom(r)).slice(0,20):[];
data.history=Array.isArray(data.history)?data.history.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r?.day)&&typeof r.subject==='string'&&Number.isFinite(r.seconds)&&r.seconds>=0).slice(-2000):[];
data.style=normalizeStyle(data.style);
let preview=local,plan: PlanId='free' as PlanId,member: Member={},session: Session | null=null,config: ClientConfig={},activeTab='customize',snapshot={} as StudySnapshot,group: Group | null=null,pollTimer: ReturnType<typeof setTimeout> | undefined,syncing=false,pendingPlan: PlanId | null=null;
let roomReady=false,groupBusy=false,groupPolling=false,groupFailures=0,groupRevision=-1,pendingRoom=false;
let configLoaded=false,authClient: FirebaseSession | null=null,authLoading=false,checkoutBusy=false,sdkPromise: Promise<void> | null=null,conflictPlan: PlanId | null=null;
try{const saved=sessionStorage.getItem('swc-checkout-plan');if(saved==='kitten'||saved==='scholar')pendingPlan=saved;}catch{}
function rememberPlan(key: PlanId | null){pendingPlan=key;try{if(key)sessionStorage.setItem('swc-checkout-plan',key);else sessionStorage.removeItem('swc-checkout-plan');}catch{}}
function report(stage: string,error: any,key: PlanId | null=null){const code=/^auth\/[a-z-]{1,60}$/.test(error?.code||'')?error.code:/^[A-Z_]{1,50}$/.test(error?.code||'')?error.code:error?.status?`HTTP_${error.status}`:'NETWORK';fetch('/api/study?action=client-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,code,plan:key})}).catch(()=>{});}

const mixer=new AmbienceMixer();
document.body.insertAdjacentHTML('beforeend',clubTemplate);
const link=document.createElement('link');link.rel='stylesheet';link.href='club.css';document.head.append(link);
const flowLink=document.createElement('link');flowLink.rel='stylesheet';flowLink.href='club-flow.css';document.head.append(flowLink);
const open=document.createElement('button');open.className='club-button';open.textContent='My desk';open.id='club-open';$('nav').prepend(open);
const previewBadge=document.createElement('button');previewBadge.className='preview-badge';previewBadge.textContent='Preview · exit';previewBadge.hidden=true;$('nav').prepend(previewBadge);
const subject=document.createElement('label');subject.className='club-subject';subject.innerHTML='Subject <input id="study-subject" maxlength="40" placeholder="What are we studying?" aria-label="Study subject">';$('#task-form').before(subject);
function placeButton(parent: HTMLElement,text: string,tool: string,className='context-tool-button'){const button=document.createElement('button');button.className=className;button.textContent=text;button.dataset.clubTab=tool;parent.append(button);return button;}
placeButton($('.cat-info'),'Change cat & outfit','customize','cat-wardrobe-open');
placeButton($('.sound-card .music-bottom'),'Mix layers ↗','mixer');$('.sound-card .music-bottom > span')?.remove();
placeButton($('.room-card'),'♡ Save this space','rooms','save-space-open');
placeButton($('.footer-stats'),'My journal ↗','reports');
placeButton($('.timer-panel'),'Study with friends ↗','together','study-together-open');
const effective=()=>preview?'scholar':plan;
const wardrobePlan=()=>preview&&local?'scholar':plan;
const message=(text: string)=>{$('#club-status').textContent=text;const shown=$('dialog[open]');const target=shown?.querySelector('[data-flow-status]');if(target)target.textContent=text;window.dispatchEvent(new CustomEvent('study-notice',{detail:text}));};
function openDialog(dialog: HTMLDialogElement){all<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());dialog.showModal();}
function showTool(tool: string,preserveDraft=false){activeTab=tool;updateAccess();if(tool==='customize'){if(!preserveDraft){$<HTMLInputElement>('#club-cat-id').value=data.style.catId;$<HTMLInputElement>('#club-outfit').value=data.style.outfit;}updateWardrobe();}openDialog($<HTMLDialogElement>(`#club-${tool}-dialog`));if(tool==='together')restoreGroup();}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{message('This browser could not save your cat club. Please keep this tab open.');}}
function requireFeature(feature: Feature){if(hasFeature(effective(),feature))return true;openDialog($<HTMLDialogElement>('#club-plans'));return false;}
function styleCat(){window.dispatchEvent(new CustomEvent('cat-style-change',{detail:canWear(wardrobePlan(),data.style)?normalizeStyle(data.style):{catId:'mochi',outfit:'none'}}));}
function updateAccess(){
 $('#club-plan').textContent=preview?'SCHOLAR CAT · PREVIEW':`${PLANS[plan]?.name||'Study Buddy'}${plan==='free'?' · FREE':''}`;
 $('#club-plan').classList.toggle('club-preview',preview);$('#club-preview-stop').hidden=!preview;
 previewBadge.hidden=!preview;
 $('#club-lock').textContent=preview?'Review preview · no paid membership.':plan==='free'?'Your free desk. Sign in or create an account, browse the wardrobe, and explore the paid extras.':'Your study setup, account and membership.';
 $('#club-sync').hidden=!hasFeature(plan,'rooms');$('#club-account').textContent=session?'My account':'Sign in / Sign up';$('#club-plans-account').textContent=session?'My account':'Sign in / Sign up';
 $('#club-preview').hidden=!(review||local);all<HTMLButtonElement>('[data-subscribe]').forEach(b=>{const state=checkoutButtonState(b.dataset.subscribe as PlanId,{ready:configLoaded?!!config.paymentsReady:null,busy:checkoutBusy,plan,member});b.disabled=state.disabled;b.textContent=state.label;});
 $('#club-billing-note').textContent=config.paymentsReady?`Monthly through Razorpay · Study Kitten ₹59/month · Scholar Cat ₹99/month. ${config.testMode?'TEST MODE — no real payments.':''}`:configLoaded?'Checkout is temporarily unavailable. Your free desk still works.':'Connecting to checkout…';
 const selected=pendingPlan&&PLANS[pendingPlan];$('#club-checkout-selection').hidden=!selected;$('#club-checkout-selection').textContent=selected?`Selected: ${selected.name} · ₹${selected.price}/month · renews monthly`:'';
 $('#club-auth-plan').textContent=selected?`You chose ${selected.name} · ₹${selected.price}/month. Sign in to continue with this plan.`:'Sign in to keep your membership connected to the right account.';
 $('#club-group-access').textContent=!roomReady?'Connecting your account…':!session?'Sign in first. Shared rooms are included in Scholar Cat.':plan==='scholar'?'Scholar Cat connected · up to six study buddies.':'Shared rooms need Scholar Cat. Your current plan is '+PLANS[plan].name+'.';
 $('#club-group-account').textContent=session?'My account':'Sign in / Sign up';roomControls();
 styleCat();renderRooms();renderJournal();updateWardrobe();
}
open.addEventListener('click',()=>openDialog($<HTMLDialogElement>('#club-workspace')));
all('[data-club-tab]').forEach(b=>b.addEventListener('click',()=>showTool(b.dataset.clubTab!)));
previewBadge.addEventListener('click',()=>openDialog($<HTMLDialogElement>('#club-plans')));
all('.club-dialog [data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')!.close()));
$('#club-plans-open').addEventListener('click',()=>openDialog($<HTMLDialogElement>('#club-plans')));
$('#club-plans-account').addEventListener('click',()=>$('#club-account').click());
for(const key of ['kitten','scholar'] as const){$(`#club-${key}-price`).replaceChildren(document.createTextNode(`₹${PLANS[key].price}`));const small=document.createElement('small');small.textContent=' / month';$(`#club-${key}-price`).append(small);}

$('#club-preview').addEventListener('click',()=>{if(!review&&!local)return;preview=true;showTool(activeTab,true);message('Preview is on. Explore your room — no payment or membership.');});
$('#club-preview-stop').addEventListener('click',()=>{preview=false;if(review){const url=new URL(location.href);url.searchParams.delete('preview');history.replaceState(null,'',url);}mixer.stop();updateAccess();$<HTMLDialogElement>('#club-plans').close();message('Preview ended. Welcome back to your free study desk.');});
$('#club-style-save').addEventListener('click',()=>{const next=normalizeStyle({catId:$<HTMLInputElement>('#club-cat-id').value,outfit:$<HTMLInputElement>('#club-outfit').value});if(!canWear(wardrobePlan(),next))return openDialog($<HTMLDialogElement>('#club-plans'));data.style=next;persist();styleCat();$<HTMLDialogElement>('#club-customize-dialog').close();window.dispatchEvent(new CustomEvent('cat-reaction',{detail:{event:'encourage'}}));message(`${CATS[data.style.catId].name} is ready to study with you.`);});
$<HTMLInputElement>('#club-cat-id').value=data.style.catId;$<HTMLInputElement>('#club-outfit').value=data.style.outfit;
function updateWardrobe(){
 const style=normalizeStyle({catId:$<HTMLInputElement>('#club-cat-id').value,outfit:$<HTMLInputElement>('#club-outfit').value}),cat=CATS[style.catId],selected=style.outfit;
 const paint=(element: HTMLElement,outfit: OutfitId)=>{const sprite=wardrobeFrame({catId:style.catId,outfit});element.dataset.outfit=outfit;element.style.backgroundImage=`url('assets/${sprite.asset}')`;element.style.backgroundPosition=`${sprite.frame%3*50}% ${Math.floor(sprite.frame/3)*100}%`;};
 paint($('#wardrobe-preview'),selected);$('#wardrobe-preview').setAttribute('aria-label',`${cat.name} · ${OUTFITS[selected].name}`);$('#wardrobe-caption').textContent=`${cat.name} · ${cat.description}`;
 const allowed=canWear(wardrobePlan(),style);$('#club-style-save').textContent=allowed?'Study with this kitten':'See paid plans · from ₹59/month';
 $('#wardrobe-access').textContent=!allowed?'Preview only · wearing this needs Study Kitten or Scholar Cat.':preview?'Review preview · no paid membership':'Your free kitten, ready to study.';
 if(allowed&&!preview&&plan!=='free')$('#wardrobe-access').textContent='Included with your membership.';
 all('[data-cat-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.catChoice===style.catId));b.querySelector('.wardrobe-tier')!.textContent=b.dataset.catChoice==='mochi'?'Free':'Paid';});
 all('[data-outfit-choice]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.outfitChoice===selected));paint(b.querySelector<HTMLElement>('.outfit-photo')!,b.dataset.outfitChoice as OutfitId);b.querySelector('.wardrobe-tier')!.textContent=b.dataset.outfitChoice==='none'&&style.catId==='mochi'?'Free':'Paid';});
}
all('[data-cat-choice]').forEach(b=>b.addEventListener('click',()=>{$<HTMLInputElement>('#club-cat-id').value=b.dataset.catChoice!;updateWardrobe();}));all('[data-outfit-choice]').forEach(b=>b.addEventListener('click',()=>{$<HTMLInputElement>('#club-outfit').value=b.dataset.outfitChoice!;updateWardrobe();}));
$('#club-rename').addEventListener('click',()=>{$<HTMLDialogElement>('#club-customize-dialog').close();$('#rename-open').click();});
updateWardrobe();
window.addEventListener('study-snapshot',e=>{snapshot=e.detail;});
const getSnapshot=()=>{window.dispatchEvent(new Event('study-snapshot-request'));return snapshot;};
$('#club-room-save').addEventListener('click',()=>{if(!requireFeature('rooms'))return;if(data.rooms.length>=20)return message('Your 20 room spots are full. Remove one before saving another.');const room=cleanRoom({...getSnapshot(),name:$<HTMLInputElement>('#club-room-name').value});if(!room)return message('Could not read the current room. Please try again.');data.rooms.push({...room,id:crypto.randomUUID(),style:{...data.style},mix:{...data.mix}});persist();renderRooms();message('Room saved on this device.');});
function renderRooms(){
 const list=$('#club-room-list');list.replaceChildren();
 if(!data.rooms.length){const empty=document.createElement('p');empty.className='spaces-empty';empty.textContent='Your favourite corners will live here. Settle into a room, then save it above.';list.append(empty);return;}
 for(const room of data.rooms){
  const item=document.createElement('article');item.className='saved-space-card';
  const image=document.createElement('img');image.src='assets/'+SCENES[room.room].file;image.alt=SCENES[room.room].detail;
  const info=document.createElement('div'),name=document.createElement('strong');name.textContent=room.name;
  const detail=document.createElement('small');detail.textContent=room.durations.focus+' minute focus · '+SCENES[room.room].name;
  const actions=document.createElement('div');actions.className='saved-space-actions';
  const load=document.createElement('button');load.className='club-text-link';load.textContent='Settle in ↗';load.addEventListener('click',async()=>{if(!requireFeature('rooms'))return;window.dispatchEvent(new CustomEvent('study-room-restore',{detail:room}));data.style=normalizeStyle(room.style);styleCat();data.mix=room.mix||{};await applyMix();persist();$<HTMLDialogElement>('#club-rooms-dialog').close();message('Your saved space is ready.');});
  const remove=document.createElement('button');remove.className='saved-space-remove';remove.textContent='×';remove.setAttribute('aria-label','Remove saved room '+room.name);remove.addEventListener('click',()=>{if(!requireFeature('rooms'))return;data.rooms=data.rooms.filter(r=>r.id!==room.id);persist();renderRooms();});
  actions.append(load,remove);info.append(name,detail,actions);item.append(image,info);list.append(item);
 }
}
const mixKind=(input: HTMLElement)=>input.dataset.mix as MixKind;
async function applyMix(){mixer.stop();for(const input of all<HTMLInputElement>('[data-mix]')){const volume=Math.max(0,Math.min(100,Number(data.mix[mixKind(input)])||0));input.value=String(volume);input.nextElementSibling!.textContent=`${volume}%`;await mixer.set(mixKind(input),volume);}}
all<HTMLInputElement>('[data-mix]').forEach(input=>input.addEventListener('input',async()=>{if(!requireFeature('mixer')){input.value='0';return;}data.mix[mixKind(input)]=Number(input.value);input.nextElementSibling!.textContent=`${input.value}%`;try{await mixer.set(mixKind(input),Number(input.value));persist();}catch{message('Your browser could not start the mixer. Try again after tapping the page.');}}));
$('#club-mix-stop').addEventListener('click',()=>{mixer.stop();data.mix={};all<HTMLInputElement>('[data-mix]').forEach(i=>{i.value='0';i.nextElementSibling!.textContent='0%';});persist();});
let historySave=0;window.addEventListener('study-focus',e=>{data.history=addFocus(data.history,e.detail);if(Date.now()-historySave>15000){persist();historySave=Date.now();if(activeTab==='reports')renderJournal();}});window.addEventListener('pagehide',persist);
$<HTMLInputElement>('#club-goal').value=String(data.goal);$('#club-goal-save').addEventListener('click',()=>{if(!requireFeature('reports'))return;const value=Number($<HTMLInputElement>('#club-goal').value);if(!Number.isInteger(value)||value<5||value>720)return message('Choose a daily goal between 5 and 720 minutes.');data.goal=value;persist();renderJournal();});
function renderJournal(){const target=$('#club-journal');target.replaceChildren();if(!hasFeature(effective(),'reports')){target.textContent='See weekly focus time, subject totals, your daily goal, and an export of your study history.';return;}const now=new Date(),today=now.toLocaleDateString('en-CA'),week: string[]=[];for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);week.push(d.toLocaleDateString('en-CA'));}const rows=data.history.filter(r=>week.includes(r.day)),total=rows.reduce((s,r)=>s+r.seconds,0);const heading=document.createElement('p');heading.className='club-stat';heading.textContent=`${Math.floor(total/60)} min this week`;const progress=document.createElement('p');const mins=Math.floor(rows.filter(r=>r.day===today).reduce((s,r)=>s+r.seconds,0)/60);progress.textContent=`Today: ${mins} / ${data.goal} minutes · ${Math.min(100,Math.round(mins/data.goal*100))}% of your goal`;const list=document.createElement('ul');list.className='club-bars';const subjects: Record<string, number>={};for(const row of rows)subjects[row.subject]=(subjects[row.subject]||0)+row.seconds;for(const [name,seconds]of Object.entries(subjects)){const li=document.createElement('li');li.textContent=`${name} · ${Math.floor(seconds/60)} min`;const bar=document.createElement('span');bar.className='club-bar';bar.style.width=`${Math.max(1,seconds/Math.max(total,1)*100)}%`;li.append(bar);list.append(li);}if(!rows.length){const li=document.createElement('li');li.textContent='Start a focus session to write the first line of your journal.';list.append(li);}target.append(heading,progress,list);}
$('#club-export').addEventListener('click',()=>{if(!requireFeature('reports'))return;const cell=(v: unknown)=>`"${String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;const csv='Date,Subject,Minutes\r\n'+data.history.map(r=>[r.day,r.subject,(r.seconds/60).toFixed(2)].map(cell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='study-with-cat-journal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// Server responses are untrusted JSON; callers check the fields they use.
async function api(action: string,body?: object): Promise<any>{
 if(action!=='config')await refreshSession();
 let response;try{response=await fetch(`/api/study?action=${encodeURIComponent(action)}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.access_token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});}catch{throw Error('The connection took too long. Check your account before retrying a payment.');}
 let value;try{value=await response.json();}catch{throw Error('The account service could not respond. Please try again.');}
 if(!response.ok)throw Object.assign(new ApiError(value.error||'That could not be completed. Please try again.'),{status:response.status,code:value.code,existingPlan:value.existingPlan});return value;
}
let clientPromise;
async function firebaseSession(){return clientPromise||=import('./firebase-session.mjs').then(m=>m.createFirebaseSession(config.firebaseConfig as object)).catch(error=>{clientPromise=null;throw error;});}
async function prepareAuth(){
 if(authLoading)return;authLoading=true;const button=$<HTMLButtonElement>('#club-auth-submit');button.disabled=true;button.textContent='Preparing Google sign-in…';
 try{if(!config.accountsReady){config=await api('config');configLoaded=true;updateAccess();}if(!config.accountsReady)throw Error('Account connection unavailable');authClient=await firebaseSession();button.textContent='Continue with Google';$('#club-auth-status').textContent='';}
 catch(error){authClient=null;button.textContent='Retry sign-in connection';$('#club-auth-status').textContent='Sign-in could not load. Check your connection, then retry.';report('sign_in_failed',error);}
 finally{authLoading=false;button.disabled=false;}
}
async function refreshSession(){if(!config.accountsReady)return;const client=await firebaseSession();session=client.user?{access_token:await client.token(),user:{email:client.user.email}}:null;}
async function refreshMember(){if(!session)return;const value=await api('me');member=value;plan=value.plan;updateAccess();return value;}
function signIn(){openDialog($<HTMLDialogElement>('#club-auth'));updateAccess();if(!authClient)prepareAuth();}
$<HTMLDialogElement>('#club-auth').addEventListener('cancel',()=>{rememberPlan(null);updateAccess();});
$('#club-auth [data-close]').addEventListener('click',()=>{rememberPlan(null);updateAccess();});
function renderAccount(){
 const pending=member.subscriptionId&&plan==='free'&&!['cancelled','completed','expired'].includes(member.status as string);
 $('#club-member-details').textContent=`${session?.user.email||''} · ${PLANS[plan].name}. ${member.paidUntil?'Paid access through '+new Date(member.paidUntil).toLocaleDateString()+'. ':''}${pending?`Unfinished ${PLANS[member.checkoutPlan!]?.name||'membership'} checkout. `:''}${member.cancelAtEnd?'Monthly renewal is stopped.':''}`;
 $<HTMLButtonElement>('#club-cancel').hidden=!member.subscriptionId||!!member.cancelAtEnd;$<HTMLButtonElement>('#club-cancel').textContent=pending?'Cancel unfinished checkout':'Stop monthly renewal';
}
async function showAccount(){
 try{await refreshSession();if(!session)return signIn();openDialog($<HTMLDialogElement>('#club-manage'));renderAccount();$('#club-manage-status').textContent='Refreshing membership…';const value=await refreshMember();renderAccount();$('#club-manage-status').textContent=value?.refreshPending?'You’re signed in. Payment confirmation is taking longer; refresh your membership shortly.':'';}
 catch(error){if(session){openDialog($<HTMLDialogElement>('#club-manage'));renderAccount();$('#club-manage-status').textContent='You’re signed in, but membership could not refresh. Try Refresh membership.';}else signIn();report('membership_refresh_failed',error);}
}
$('#club-account').addEventListener('click',showAccount);$('#club-member-refresh').addEventListener('click',showAccount);
$<HTMLButtonElement>('#club-auth-submit').addEventListener('click',async()=>{
 if(!authClient)return prepareAuth();const button=$<HTMLButtonElement>('#club-auth-submit');button.disabled=true;$('#club-auth-status').textContent='Complete sign-in in the Google window…';
 try{
  const result=await loginAndRefresh(authClient,{refreshSession,refreshMember});$<HTMLDialogElement>('#club-auth').close();roomReady=true;updateAccess();
  if(result.membershipError){report('membership_refresh_failed',result.membershipError);openDialog($<HTMLDialogElement>('#club-manage'));renderAccount();$('#club-manage-status').textContent='Google sign-in succeeded. Membership could not refresh yet; tap Refresh membership to try again.';return;}
  message('You’re signed in.');if(pendingPlan)await checkout(pendingPlan);else if(pendingRoom){pendingRoom=false;showTool('together');}
 }catch(error){$('#club-auth-status').textContent=authErrorText(error);report('sign_in_failed',error);}
 finally{button.disabled=false;}
});
$('#club-signout').addEventListener('click',async()=>{try{await(await firebaseSession()).signOut();}catch{return message('Sign-out could not finish. Please try again.');}session=null;plan='free';member={};rememberPlan(null);mixer.stop();clearTimeout(pollTimer);renderGroup(null);$<HTMLDialogElement>('#club-manage').close();updateAccess();message('Signed out. This device’s study data is still here.');});
$<HTMLButtonElement>('#club-cancel').addEventListener('click',async()=>{
 if(!confirm('Stop this checkout or future monthly renewals? Any paid features remain until the end of your paid month.'))return;
 const button=$<HTMLButtonElement>('#club-cancel');button.disabled=true;
 try{member=await api('cancel',{});plan=member.plan as PlanId;renderAccount();$('#club-manage-status').textContent='Future renewal is stopped. Any current paid access remains until its end date.';updateAccess();}
 catch(error){$('#club-manage-status').textContent=error.message;}finally{button.disabled=false;}
});
function releaseCheckout(){checkoutBusy=false;updateAccess();}
async function loadRazorpay(){
 if(window.Razorpay)return;if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');const timer=setTimeout(()=>{script.remove();reject(Error('Razorpay could not load. Check your connection and try again.'));},15000);script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Razorpay could not load. Please try again.'));};document.head.append(script);}).catch(error=>{sdkPromise=null;throw error;});return sdkPromise;
}
async function checkout(key: PlanId){
 if(checkoutBusy)return;if(plan!=='free')return showAccount();rememberPlan(key);checkoutBusy=true;updateAccess();$('#club-checkout-recovery').hidden=true;$('#club-checkout-status').textContent='Preparing your selected plan…';let opened=false;
 try{
  if(!config.paymentsReady){config=await api('config');configLoaded=true;updateAccess();if(!config.paymentsReady)throw Error('Checkout is temporarily unavailable. Please try again shortly.');}
  await refreshSession();if(!session){releaseCheckout();signIn();return;}
  const value=await api('subscribe',{plan:key});if(value.plan!==key||value.monthlyPrice!==PLANS[key].price)throw Error('The checkout plan did not match your selection. No payment was opened. Please contact support.');
  member={...member,subscriptionId:value.subscriptionId,checkoutPlan:value.plan,status:value.status||'created',cancelAtEnd:false};updateAccess();await loadRazorpay();$<HTMLDialogElement>('#club-plans').close();
  let completed=false;const pay=new window.Razorpay!({key:value.keyId,subscription_id:value.subscriptionId,name:'Study With Cat',description:`${PLANS[value.plan as PlanId].name} · ₹${value.monthlyPrice}/month`,prefill:{email:session.user?.email},theme:{color:'#84583f'},handler:async response=>{
   completed=true;openDialog($<HTMLDialogElement>('#club-manage'));$('#club-manage-status').textContent='Confirming your payment. Please keep this page open…';
   try{let verified=await api('verify',{...response});for(let attempt=0;verified.plan==='free'&&attempt<3;attempt++){await new Promise(resolve=>setTimeout(resolve,1500));verified=await api('me');}plan=verified.plan;member=verified;preview=false;rememberPlan(null);updateAccess();renderAccount();$('#club-manage-status').textContent=plan==='free'?'Payment is still being confirmed. Tap Refresh membership shortly; please do not pay again.':`Your ${PLANS[plan].name} membership is ready. Welcome!`;}
   catch(error){renderAccount();$('#club-manage-status').textContent='Your payment could not be confirmed here yet. Tap Refresh membership before retrying a payment, or contact support.';report('verification_failed',error,key);}
   finally{releaseCheckout();}
  },modal:{ondismiss:()=>{if(completed)return;releaseCheckout();openDialog($<HTMLDialogElement>('#club-plans'));$('#club-checkout-status').textContent='Checkout closed. You can resume this plan, or select the other plan. If you paid, use My account to check membership first.';}}});
  pay.on('payment.failed',response=>{$('#club-checkout-status').textContent='Payment was not completed. Check the reason in Razorpay before retrying.';report('payment_failed',{code:'PAYMENT_FAILED'},key);});pay.open();opened=true;
 }catch(error){
  openDialog($<HTMLDialogElement>('#club-plans'));$('#club-checkout-status').textContent=error.message;report('checkout_open_failed',error,key);
  if(error.code==='CHECKOUT_PLAN_CONFLICT'){conflictPlan=error.existingPlan;$('#club-checkout-recovery').hidden=false;$('#club-resume-checkout').textContent=`Resume ${PLANS[conflictPlan!].name}`;$('#club-change-checkout').textContent=`Stop previous checkout & choose ${PLANS[key].name}`;}
 }finally{if(!opened)releaseCheckout();}
}
$('#club-resume-checkout').addEventListener('click',()=>{if(conflictPlan)checkout(conflictPlan);});
$('#club-change-checkout').addEventListener('click',async()=>{
 if(checkoutBusy)return;const next=pendingPlan;if(!next)return;
 checkoutBusy=true;updateAccess();$('#club-checkout-status').textContent='Checking and stopping the previous checkout…';
 try{member=await api('cancel',{pendingOnly:true,subscriptionId:member.subscriptionId});plan=member.plan as PlanId;releaseCheckout();if(plan!=='free'){rememberPlan(null);return showAccount();}if(!['cancelled','completed','expired'].includes(member.status as string))return showAccount();await checkout(next);}
 catch(error){$('#club-checkout-status').textContent=error.message;releaseCheckout();}
});
all('[data-subscribe]').forEach(b=>b.addEventListener('click',()=>checkout(b.dataset.subscribe as PlanId)));
$('#club-sync').addEventListener('click',async()=>{if(!session)return signIn();if(syncing)return;syncing=true;try{await api('state',{data});message('Your cat club setup and journal are backed up to your account.');}catch(e){message(e.message);}finally{syncing=false;}});
const restore=document.createElement('button');restore.className='club-secondary';restore.textContent='Restore account backup';$('#club-sync').after(restore);restore.addEventListener('click',async()=>{if(!session)return signIn();try{const value=await api('state');if(!value.data)return message('No account backup yet. Save this device’s setup first.');if(!confirm('Replace this device’s cat club setup and journal with your account backup?'))return;data=value.data;data.style=normalizeStyle(data.style);persist();$<HTMLInputElement>('#club-cat-id').value=data.style.catId;$<HTMLInputElement>('#club-outfit').value=data.style.outfit;$<HTMLInputElement>('#club-goal').value=String(data.goal);updateAccess();message('Your account backup is restored.');}catch(e){message(e.message);}});
function groupStatus(text: string){$('#club-group-status').textContent=text;}
function roomControls(){for(const id of ['create','join','reconnect','leave','publish'])$<HTMLButtonElement>('#club-group-'+id).disabled=groupBusy||!roomReady;}
function scheduleRoomPoll(){clearTimeout(pollTimer);if(group&&!document.hidden)pollTimer=setTimeout(pollRoom,groupFailures?Math.min(30000,5000*2**groupFailures):5000);}
function renderGroup(value: Group | null,restoreTimer=false){
 const changed=group?.id!==value?.id;group=value;if(changed)groupRevision=-1;
 window.dispatchEvent(new CustomEvent('study-shared-active',{detail:!!value}));window.dispatchEvent(new CustomEvent('study-shared-mode',{detail:!!value&&!value.isHost}));
 $('#club-group-setup').hidden=!!value;$('#club-group-active').hidden=!value;
 if(!value){clearTimeout(pollTimer);groupRevision=-1;return;}
 $('#club-group-title').textContent=value.name;$('#club-group-members').textContent=`${value.members.length}/6 · `+value.members.map(m=>m.name+(m.host?' (host)':'')).join(' · ');
 $<HTMLInputElement>('#club-group-code').value=location.origin+'/#room='+value.code;
 $('#club-group-role').textContent=value.isHost?'You’re the host. Use the main timer to start, pause, or change the study rhythm. Your friends follow automatically.':'Your host controls the timer. Your tasks, cat, music, and scenery stay your own.';
 $('#club-group-expiry').textContent=value.expiresAt?'Room ends '+new Date(value.expiresAt).toLocaleString()+'. Keep this link private.':'Keep this link private.';
 $('#club-group-publish').hidden=!value.isHost;$('#club-group-leave').textContent=value.isHost?'End room for everyone':'Leave room';
 if((restoreTimer||!value.isHost)&&(restoreTimer||Number(value.timerRevision)>groupRevision)){
  const state=sharedTimerState(value);if(state)window.dispatchEvent(new CustomEvent('study-shared-timer',{detail:state}));
 }
 groupRevision=Math.max(groupRevision,value.timerRevision||0);groupFailures=0;scheduleRoomPoll();
}
async function pollRoom(){
 if(!group||groupBusy||groupPolling||document.hidden)return scheduleRoomPoll();const id=group.id;groupPolling=true;
 try{const value=await api('group',{id,operation:'read'});if(group?.id!==id)return;renderGroup(value);groupStatus('Connected · timer and members update automatically.');}
 catch(error){if(group?.id!==id)return;if([403,404].includes(error.status)){renderGroup(null);groupStatus(error.status===404?'This room ended or expired. You can create or join another.':error.message);}else{groupFailures++;groupStatus(error.status===401?'Sign in again, then reconnect to your room.':'Connection interrupted. Retrying automatically; your room is kept.');if(error.status===401)clearTimeout(pollTimer);else scheduleRoomPoll();}}
 finally{groupPolling=false;}
}
async function restoreGroup(){
 if(!roomReady||groupBusy||!session||plan!=='scholar')return;groupBusy=true;roomControls();groupStatus('Reconnecting to your study room…');
 try{const value=await api('group',{operation:'current'});renderGroup(value,true);groupStatus(value?'Reconnected. Your study room and timer are ready.':'No active room yet. Create one or paste a friend’s invitation.');}
 catch(error){groupStatus('Could not reconnect. '+error.message);if(group)scheduleRoomPoll();}
 finally{groupBusy=false;roomControls();}
}
async function startGroup(operation: 'create' | 'join'){
 if(groupBusy)return;
 if(!session){pendingRoom=true;signIn();return;}
 if(!requireFeature('together'))return;
 const code=operation==='join'?inviteCode($<HTMLInputElement>('#club-invite-code').value):null;
 if(operation==='join'&&!code)return groupStatus('Paste a complete invite link or its 32-character code.');
 groupBusy=true;roomControls();groupStatus(operation==='create'?'Making your study room…':'Joining your friends…');
 try{
  const existing=await api('group',{operation:'current'});
  if(existing&&(operation==='create'||existing.code!==code)){renderGroup(existing,true);groupStatus('Your existing room is restored. Leave it before joining a different room.');return;}
  const value=await api('group',{operation,name:$<HTMLInputElement>('#club-group-name').value.trim()||'Our study desk',code,nameTag:getSnapshot().kittenName});renderGroup(value,operation==='join');pendingRoom=false;try{sessionStorage.removeItem('swc-room-invite');}catch{}
  if(operation==='create')await publishRoomTimer();
  groupStatus(operation==='create'?'Room ready. Copy the invite link, then start the main timer.':'You’re in. Your timer follows the host.');
 }catch(error){groupStatus(error.message);}
 finally{groupBusy=false;roomControls();}
}
let publishingTimer=false,timerQueued=false;
async function publishRoomTimer(){
 if(!group?.isHost)return;if(publishingTimer){timerQueued=true;return;}publishingTimer=true;const id=group.id;
 try{do{timerQueued=false;const s=getSnapshot(),timer={phase:s.phase,seconds:s.deadline?Math.max(0,Math.ceil((s.deadline-Date.now())/1000)):s.seconds,running:!!s.deadline,durations:s.durations};const value=await api('group',{operation:'timer',id,timer});if(group?.id!==id)return;renderGroup(value);groupStatus('Timer shared. Friends follow your start, pause, and break changes.');}while(timerQueued&&group?.id===id);}
 catch(error){groupStatus('Timer could not sync. Tap Share current timer to retry. '+error.message);return false;}
 finally{publishingTimer=false;}
}
$('#club-group-account').addEventListener('click',()=>{pendingRoom=true;showAccount();});
$('#club-group-create').addEventListener('click',()=>startGroup('create'));
$('#club-group-join').addEventListener('click',()=>startGroup('join'));
$('#club-group-reconnect').addEventListener('click',restoreGroup);
$('#club-group-publish').addEventListener('click',()=>{if(!groupBusy)publishRoomTimer();});
for(const control of all('#start,#reset,[data-phase],#settings-form'))control.addEventListener(control.tagName==='FORM'?'submit':'click',()=>{if(group?.isHost)setTimeout(publishRoomTimer,0);});
window.addEventListener('study-timer-change',publishRoomTimer);
$('#club-group-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($<HTMLInputElement>('#club-group-code').value);groupStatus('Invite link copied. Share it with your Scholar Cat friends.');}catch{groupStatus('Copy the private invite link from the field above.');$<HTMLInputElement>('#club-group-code').select();}});
$('#club-group-leave').addEventListener('click',async()=>{
 if(!group||groupBusy)return;if(group.isHost&&!confirm('End this study room for everyone? Friends will return to their own timers.'))return;
 const id=group.id;groupBusy=true;roomControls();
 try{await api('group',{operation:'leave',id});renderGroup(null);groupStatus('You’ve left the room. Your personal study desk is ready.');}
 catch(error){if(error.status===404){renderGroup(null);groupStatus('This room has already ended.');}else groupStatus(error.message);}
 finally{groupBusy=false;roomControls();}
});
function readRoomInvitation(){let code=inviteCode(location.href);try{code=code||inviteCode(sessionStorage.getItem('swc-room-invite'));if(code)sessionStorage.setItem('swc-room-invite',code);}catch{}if(!code)return;$<HTMLInputElement>('#club-invite-code').value=code;history.replaceState(null,'',location.pathname+location.search);pendingRoom=true;showTool('together');}
window.addEventListener('hashchange',readRoomInvitation);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(pollTimer);else if(group)restoreGroup();});
window.addEventListener('online',()=>{if(group)restoreGroup();});

updateAccess();
config=await releaseRequest||{};configLoaded=true;preview=local&&!config.paymentsReady;updateAccess();
if(!config.accountsReady){$('#club-checkout-status').textContent='Account connection could not load. Try signing in again to reconnect.';return;}
await prepareAuth();
try{await refreshSession();updateAccess();if(session)await refreshMember();}catch(error){report('membership_refresh_failed',error);}
roomReady=true;updateAccess();
if(session&&plan==='scholar')await restoreGroup();else renderGroup(null);
readRoomInvitation();

}
startClub().catch(error=>console.error('Cat club could not load',error.name));

