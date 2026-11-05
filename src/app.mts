import { formatTime, remaining, nextPhase, validMinutes, studyActivity, cleanKittenName, PHASES, isPhase, type Phase, type Durations } from './core.mjs';
import { catLine } from './cat-dialogue.mjs';
import {CATS,normalizeStyle,companionFrame,type CatStyle} from './companions.mjs';
import {isRoomId,type RoomId} from './membership.mjs';
import {installStudyFlow,SCENES} from './room-flow.mjs';
import {SpotifyConnection,type SpotifyCollection} from './spotify.mjs';
import {$,all} from './dom.mjs';
type SoundKind = 'lofi' | 'rain' | 'brown' | 'own' | 'spotify';
interface Task {id: string; text: string; done: boolean}
const field = (form: HTMLFormElement, name: string) => form.elements.namedItem(name) as HTMLInputElement;
const extraReactions = document.createElement('div');
extraReactions.className = 'cat-extra-controls';
extraReactions.innerHTML = '<button data-cat-extra="stretch">↟ Stretch together</button><button data-cat-extra="treat">♡ Tiny treat</button>';
$('.cat-controls').after(extraReactions);
all('[data-cat-extra]').forEach(button => button.addEventListener('click', () => react(button.dataset.catExtra === 'stretch' ? 4 : 5, catLine(button.dataset.catExtra!), 4200)));
const STORAGE = 'study-with-cat-v1';
const today = () => new Date().toLocaleDateString('en-CA');
// Parsed from browser storage, so every field is validated below.
let saved: any = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch {}
let kittenName = cleanKittenName(saved.kittenName) || 'Mochi';
let catStyle: CatStyle={catId:'mochi',outfit:'none'};
let dockWanted = saved.dockWanted !== false, lastSound: SoundKind = 'lofi';
const durations: Durations = { focus: 25, short: 5, long: 15 };
for (const phase of PHASES) if (validMinutes(saved.durations?.[phase])) durations[phase] = Number(saved.durations[phase]);
let phase: Phase = isPhase(saved.phase) ? saved.phase : 'focus';
let seconds: number = Number.isFinite(saved.seconds) && saved.seconds >= 0 && saved.seconds <= durations[phase] * 60 ? saved.seconds : durations[phase] * 60;
let deadline: number | null = Number.isFinite(saved.deadline) && saved.deadline > 0 ? saved.deadline : null;
let completed: number = saved.day === today() && Number.isInteger(saved.completed) && saved.completed >= 0 ? saved.completed : 0;
let focused: number = saved.day === today() && Number.isFinite(saved.focused) && saved.focused >= 0 ? saved.focused : 0;
let accountedUntil: number = Number.isFinite(saved.accountedUntil) ? saved.accountedUntil : Date.now();
if (saved.day !== today()) accountedUntil = Math.max(accountedUntil, new Date().setHours(0,0,0,0));
let tasks: Task[] = Array.isArray(saved.tasks) ? saved.tasks.filter((t: any) => t && typeof t.id === 'string' && typeof t.text === 'string' && t.text.length <= 160).slice(0, 100).map((t: any) => ({ ...t, done: !!t.done })) : [];
let room: RoomId = isRoomId(saved.room) ? saved.room : 'sunset';
let day = today(), hour12 = saved.hour12 !== false, sound: SoundKind | null = null, reactionUntil = 0, reactionFrame = 0, catMessage = '', toastTimer: ReturnType<typeof setTimeout> | undefined, playTimer: ReturnType<typeof setTimeout> | undefined;
let activityOffset = 0, previewActivity = false, sharedGuest=!!saved.sharedGuest, sharedRoom=!!saved.sharedRoom, sharedReady=!saved.sharedRoom;
let lineOffset = Math.floor(Math.random() * 100);
const studyLabels = ['doing the homework. finally.', 'trying to finish this chapter', 'studying with headphones', 'hoping for an easy question', 'last-minute revision', 'a very small student'];
function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
let storageWarned = false;
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ durations, phase, seconds, deadline, completed, focused, accountedUntil, tasks, room, day, hour12, kittenName, dockWanted,catStyle,sharedGuest,sharedRoom })); }
  catch { if (!storageWarned) { toast('Your browser cannot save this room. Keep this tab open.'); storageWarned = true; } }
}
function account(now: number) {
  if (day !== today()) { day = today(); completed = 0; focused = 0; accountedUntil = Math.max(accountedUntil, new Date().setHours(0,0,0,0)); }
  if (deadline && phase === 'focus') {
    const added = Math.max(0, (Math.min(now, deadline) - accountedUntil) / 1000);
    focused += added;
    if (added) window.dispatchEvent(new CustomEvent('study-focus', {detail:{seconds:added, day, subject:document.querySelector<HTMLInputElement>('#study-subject')?.value || 'General'}}));
  }
  accountedUntil = now;
}
function renderCat() {
  $('#cat-name').textContent = kittenName;
  $('#cat').setAttribute('aria-label', `Pet ${kittenName} the cat`);
  $('#cat').title = `Give ${kittenName} a little pat`;
  $('#ball').setAttribute('aria-label', `Play ball with ${kittenName}`);
  const temporary = Date.now() < reactionUntil;
  const studying = !temporary && phase === 'focus' && (!!deadline || previewActivity);
  const elapsed = durations.focus * 60 - seconds;
  const activity = studyActivity(elapsed, activityOffset + (sound ? 2 : 0));
  const encouragement = Math.floor(elapsed / 45) % 2 === 1;
  const sprite=companionFrame({...catStyle,studying,listening:!!sound,resting:phase!=='focus',temporary,reaction:reactionFrame,activity});
  const frame=sprite.frame;
  $('#cat').style.backgroundImage = `url('assets/${sprite.asset}')`;
  $('#cat').style.clipPath = sprite.original ? !studying && frame === 4 ? 'inset(0 9% 0 0)' : 'none' : !sprite.accessory&&frame===4 ? 'polygon(15% 0,100% 0,100% 100%,0 100%,0 65%,15% 65%)' : 'inset(0 3% 0 3%)';
  $('#cat').style.backgroundPosition = `${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%`;
  $('#cat').classList.toggle('listening', !!sound && !temporary);
  $('#cat-state').textContent = temporary ? 'a happy little cat' : studying ? studyLabels[activity] : sound ? 'in a world of music' : phase !== 'focus' ? 'resting those little paws' : 'your study buddy';
  const lineIndex = lineOffset + Math.floor((studying ? elapsed : Date.now() / 1000) / 45);
  const message = temporary ? catMessage : catLine(studying ? (encouragement ? 'encourage' : 'study') : phase !== 'focus' ? 'break' : sound ? 'music' : 'idle', lineIndex);
  if ($('#cat-message').textContent !== message) $('#cat-message').textContent = message;
  const canPlay = phase !== 'focus' || !deadline;
  $<HTMLButtonElement>('#play').disabled = !canPlay;
  $('#play').title = canPlay ? `Play ball with ${kittenName}` : `${kittenName} will play during your break`;
}
function react(frame: number, message: string, duration = 2600) { reactionFrame = frame; catMessage = message; reactionUntil = Date.now() + duration; renderCat(); }
function renderTimer() {
  for(const button of [$<HTMLButtonElement>('#start'),$<HTMLButtonElement>('#reset'),$<HTMLButtonElement>('#settings-open'),...all<HTMLButtonElement>('[data-phase]')])button.disabled=sharedGuest||!sharedReady;
  $('#timer').textContent = formatTime(seconds);
  $('#timer').setAttribute('aria-label', `${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`);
  document.title = `${deadline ? formatTime(seconds) + ' · ' : ''}Study With Cat — Aesthetic Pomodoro Timer`;
  all('[data-phase]').forEach(button => { const active = button.dataset.phase === phase; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  $('#timer-caption').textContent = !sharedReady?'RECONNECTING TO YOUR ROOM':sharedGuest&&!seconds?'WAITING FOR YOUR HOST':sharedGuest?'FOLLOWING YOUR HOST':phase === 'focus' ? 'ONE THING AT A TIME' : 'REST IS PART OF THE WORK';
  $('#start').replaceChildren();
  const icon = document.createElement('span'); icon.textContent = deadline ? 'Ⅱ' : '▶';
  $('#start').append(icon, deadline ? 'Pause a moment' : phase === 'focus' ? 'Start focusing' : 'Start my break');
  const firstTask = tasks.find(t => !t.done);
  $('#intention').textContent = phase === 'focus' ? firstTask ? firstTask.text : 'A small start is still a start.' : `Stretch, sip some water, say hello to ${kittenName}.`;
  all('.session-dots i').forEach((dot, i) => dot.classList.toggle('filled', i < (completed % 4 || (completed ? 4 : 0))));
  $('#session-label').textContent = completed ? `${completed} small ${completed === 1 ? 'victory' : 'victories'} today` : 'Your first little step';
  $('#focus-total').textContent = `${Math.floor(focused / 60)} min of focus today`;
  renderCat();
}
function finish() {
  if(sharedGuest){deadline=null;seconds=0;save();renderTimer();return;}
  const endedPhase = phase;
  if (phase === 'focus') completed++;
  deadline = null; phase = nextPhase(phase, completed); seconds = durations[phase] * 60;
  if (endedPhase === 'focus') { react(5, catLine('finish'), 5000); toast('Focus session complete. Your break is ready.'); }
  else { react(0, 'Feeling refreshed? Let’s turn the page.', 4000); toast('Break complete. Your next focus session is ready.'); }
  // shortcut: alarms run while the page is awake; add service-worker notifications if closed-tab reminders are needed.
  chime(); save(); renderTimer(); window.dispatchEvent(new Event('study-timer-change'));
}
function tick() {
  const now = Date.now(); account(now);
  if (deadline) { seconds = remaining(deadline, now); if (seconds === 0&&sharedReady) finish(); else { renderTimer(); save(); } }
  else renderCat();
  $('#clock').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12 }).format(new Date());
  $<HTMLTimeElement>('#clock').dateTime = new Date().toISOString();
  $('#focus-total').textContent = `${Math.floor(focused / 60)} min of focus today`;
}
$('#start').addEventListener('click', () => { account(Date.now()); previewActivity = false; reactionUntil = 0; const wasRunning = !!deadline; if (deadline) { seconds = remaining(deadline); deadline = null; } else { deadline = Date.now() + seconds * 1000; accountedUntil = Date.now(); } save(); renderTimer(); react(wasRunning ? 4 : 0, catLine(wasRunning ? 'pause' : phase === 'focus' ? 'start' : 'break')); });
$('#reset').addEventListener('click', () => { account(Date.now()); deadline = null; seconds = durations[phase] * 60; save(); renderTimer(); });
all('[data-phase]').forEach(button => button.addEventListener('click', () => {
  if (phase === button.dataset.phase) return;
  if (deadline && !confirm('Switching modes will reset your current timer. Switch now?')) return;
  account(Date.now()); phase = button.dataset.phase as Phase; deadline = null; seconds = durations[phase] * 60; save(); renderTimer();
}));
function renderTasks() {
  $('#tasks').replaceChildren();
  if (!tasks.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'One chapter? A few flashcards? Start small.'; $('#tasks').append(li); }
  tasks.forEach(task => {
    const li = document.createElement('li'); li.classList.toggle('done', task.done);
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done; checkbox.id = `task-${task.id}`;
    const label = document.createElement('label'); label.htmlFor = checkbox.id; label.textContent = task.text;
    const remove = document.createElement('button'); remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete task: ${task.text}`);
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; if (task.done) react(5, catLine('task')); save(); renderTasks(); renderTimer(); });
    remove.addEventListener('click', () => { tasks = tasks.filter(t => t.id !== task.id); save(); renderTasks(); renderTimer(); });
    li.append(checkbox, label, remove); $('#tasks').append(li);
  });
  $('#task-count').textContent = `${tasks.filter(t => t.done).length} / ${tasks.length}`;
}
$('#task-form').addEventListener('submit', event => { event.preventDefault(); const text = $<HTMLInputElement>('#task-input').value.trim(); if (!text) return; if (tasks.length >= 100) return toast('Your desk has 100 intentions. Clear a few before adding more.'); tasks.push({id: crypto.randomUUID(), text, done:false}); $<HTMLInputElement>('#task-input').value = ''; save(); renderTasks(); renderTimer(); });
function pet() { react(0, catLine('pet')); $('#hearts').classList.remove('show'); $('#cat').classList.remove('patted'); void $('#cat').offsetWidth; $('#hearts').classList.add('show'); $('#cat').classList.add('patted'); }
$('#pet').addEventListener('click', pet); $('#cat').addEventListener('click', pet);
$('#next-cat').addEventListener('click', () => {
  lineOffset++; if (phase === 'focus') { activityOffset = (activityOffset + 1) % 6; previewActivity = true; reactionUntil = 0; renderCat(); }
  else { react(3, catLine('break')); }
});
function play() { if (deadline && phase === 'focus') return toast(`${kittenName} is studying. Save the ball for your break.`); clearTimeout(playTimer); react(3, catLine('ball'), 6500); $('.companion-panel').classList.add('playing'); playTimer = setTimeout(() => $('.companion-panel').classList.remove('playing'), 6500); }
$('#play').addEventListener('click', play); $('#ball').addEventListener('click', play);
const backgrounds: Record<RoomId, string> = {sunset:"url('assets/sunset.webp')",garden:"url('assets/garden.webp')",rain:"url('assets/rain.webp')",lavender:"url('assets/meadow.webp')",night:"url('assets/library.webp')",cream:"url('assets/coast.webp')"};
function setRoom(value: RoomId, interaction = true) {
  room = value; $('.wallpaper').style.backgroundImage = backgrounds[room]; document.body.classList.toggle('night-theme', room === 'night');
  if($('#room-current'))$('#room-current').textContent=SCENES[room].name;
  all('[data-room]').forEach(button => { button.classList.toggle('selected', button.dataset.room === room); button.setAttribute('aria-pressed', String(button.dataset.room === room)); });
  if (interaction) { react(0, {sunset:'Ooh, peach skies. Let’s stay a while.',garden:'I think I saw a butterfly…',rain:'Rain outside. Warm little paws inside.',lavender:'This feels like a very soft dream.',night:'Just us and the night. One page at a time.',cream:'A fresh little room. A fresh little start.'}[room]); save(); }
}
all('[data-room]').forEach(button => button.addEventListener('click', () => { setRoom(button.dataset.room as RoomId); const rooms = $<HTMLDialogElement>('#rooms'); if (rooms.open) rooms.close(); }));
$('#rooms-open').addEventListener('click', () => $<HTMLDialogElement>('#rooms').showModal());
$('#settings-open').addEventListener('click', () => { for (const p of PHASES) field($<HTMLFormElement>('#settings-form'), p).value = String(durations[p]); $<HTMLDialogElement>('#settings').showModal(); });
$('#rename-open').addEventListener('click', () => { const input = $<HTMLInputElement>('#kitten-name'); input.value = kittenName; $<HTMLDialogElement>('#rename').showModal(); input.select(); });
$('#rename-form').addEventListener('submit', event => {
  event.preventDefault(); const name = cleanKittenName($<HTMLInputElement>('#kitten-name').value);
  if (!name) return toast('Give your kitten a little name first.');
  kittenName = name; save(); renderTimer(); $<HTMLDialogElement>('#rename').close(); toast(`${kittenName} is ready to study with you.`);
});
all('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog')!.close()));
$('#settings-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  if(sharedGuest)return toast('Your host controls the shared study rhythm.');
  if (!PHASES.every(p => validMinutes(field(form, p).value))) return toast('Choose whole minutes between 1 and 180.');
  if (deadline && !confirm('Saving your rhythm resets this session. Save now?')) return;
  account(Date.now()); for (const p of PHASES) durations[p] = Number(field(form, p).value); deadline = null; seconds = durations[phase] * 60; save(); renderTimer(); $<HTMLDialogElement>('#settings').close(); toast('Your study rhythm is saved.');
});
function showDock(on: boolean) { document.body.classList.toggle('dock-visible', on); $('#music-dock-open').setAttribute('aria-expanded', String(on)); }
$('#music-dock-open').addEventListener('click', () => { dockWanted = !document.body.classList.contains('dock-visible'); showDock(dockWanted); save(); });
$('#music-dock-close').addEventListener('click', () => { dockWanted = false; showDock(false); save(); });
function setFocusMode(on: boolean) { document.body.classList.toggle('quiet', on); $('#quiet').setAttribute('aria-pressed', String(on)); $('#quiet').setAttribute('aria-label', on ? 'Exit focus mode' : 'Enter focus mode'); $('#focus-mode-label').textContent = on ? 'Exit Focus' : 'Focus Mode'; showDock(on && dockWanted); }
$('#quiet').addEventListener('click', () => setFocusMode(!document.body.classList.contains('quiet')));
$('#fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Full screen is not available in this browser.'); } });
document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
$('#clock-mode').addEventListener('click', () => { hour12 = !hour12; save(); tick(); });
document.addEventListener('keydown', event => {
  if (all<HTMLDialogElement>('dialog').some(d => d.open)) return;
  if (event.key === 'Escape' && document.body.classList.contains('quiet')) setFocusMode(false);
  if (event.target !== document.body) return;
  if (event.code === 'Space') { event.preventDefault(); $('#start').click(); }
  if (event.key.toLowerCase() === 'f') setFocusMode(!document.body.classList.contains('quiet'));
});
let audioContext: AudioContext | undefined, gain: GainNode | undefined, soundNodes: AudioScheduledSourceNode[] = [], melodyTimer: ReturnType<typeof setInterval> | undefined, songUrl: string | null = null, soundSwitching = false;
const song = $<HTMLAudioElement>('#own-song');
const spotify = new SpotifyConnection(() => { if (sound === 'spotify' && !spotify.playing) sound = null; renderSound(); });
function context(): AudioContext { if (!audioContext) { audioContext = new AudioContext(); gain = audioContext.createGain(); gain.gain.value = Number($<HTMLInputElement>('#volume').value) / 100; gain.connect(audioContext.destination); } return audioContext; }
function stopSound() { clearInterval(melodyTimer); for (const node of soundNodes) { try { node.stop(); } catch {} node.disconnect(); } soundNodes = []; song.pause(); if (sound === 'spotify') spotify.pause().catch(() => {}); sound = null; }
function tone(frequency: number, time: number, length = 1.8, volume = .13) {
  const ctx = context(), osc = ctx.createOscillator(), envelope = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(volume, time + .025); envelope.gain.exponentialRampToValueAtTime(.001, time + length);
  osc.connect(envelope); envelope.connect(gain!); soundNodes.push(osc); osc.start(time); osc.stop(time + length + .02); osc.onended = () => { osc.disconnect(); envelope.disconnect(); soundNodes = soundNodes.filter(node => node !== osc); };
}
function noise(kind: 'rain' | 'brown') {
  const ctx = context(), buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0); let last = 0;
  for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; last = (last + .02 * white) / 1.02; data[i] = kind === 'brown' ? last * 3.5 : white * .32; }
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(); source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = kind === 'rain' ? 2100 : 700; source.connect(filter); filter.connect(gain!); source.start(); source.onended = () => filter.disconnect(); soundNodes.push(source);
}
function renderSound() {
  all('[data-sound]').forEach(button => { const on = button.dataset.sound === sound; button.classList.toggle('selected', on); button.setAttribute('aria-pressed', String(on)); });
  $('#sound-status').textContent = sound ? 'PLAYING' : 'SOUND OFF';
  $('#dock-status').textContent = sound ? {lofi:'Soft keys · playing',rain:'Rainfall · playing',brown:'Brown noise · playing',own:'Your own music · playing',spotify:spotify.track ? `${spotify.track.name} · Spotify` : 'Spotify · playing'}[sound] : 'Pick your study sound';
  $('#dock-toggle').textContent = sound ? 'Ⅱ' : '▶';
  $('#dock-toggle').setAttribute('aria-label', sound ? 'Pause background sound' : 'Play background sound');
  $('#upload-song').textContent = sound === 'own' ? 'Ⅱ Pause your music' : songUrl ? '▶ Your music' : '＋ Your own music';
  $('#dock-spotify').classList.toggle('selected', sound === 'spotify'); $('#dock-spotify').setAttribute('aria-pressed', String(sound === 'spotify'));
  renderSpotify(); renderCat();
}
async function selectSound(kind: SoundKind) {
  if (soundSwitching) return;
  soundSwitching = true;
  try {
    const same = sound === kind; stopSound();
    if (!same) {
      const ctx = context(); await ctx.resume(); sound = kind; lastSound = kind;
      if (kind === 'lofi') {
        let bar = 0; const chords = [[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
        const phrase = () => { const notes = chords[bar++ % chords.length], now = ctx.currentTime; notes.forEach((f, i) => tone(f / 2, now + i * .12, 3.8, .12)); [notes[0]*2,notes[1]*2,notes[2],notes[1]].forEach((f, i) => tone(f, now + i * .8, 1.6, .06)); };
        phrase(); melodyTimer = setInterval(phrase, 4000);
      } else if (kind === 'spotify') await spotify.resume();
      else if (kind === 'own') { song.volume = Number($<HTMLInputElement>('#volume').value) / 100; await song.play(); } else noise(kind);
    }
    renderSound();
  } catch (error) { stopSound(); renderSound(); toast(kind === 'spotify' && error instanceof Error ? error.message : 'Sound couldn’t start. Try another sound or audio file.'); }
  finally { soundSwitching = false; }
}
all<HTMLButtonElement>('[data-sound]').forEach(button => button.addEventListener('click', async () => { all<HTMLButtonElement>('[data-sound]').forEach(b => b.disabled = true); await selectSound(button.dataset.sound as SoundKind); all<HTMLButtonElement>('[data-sound]').forEach(b => b.disabled = false); }));
for (const control of [$<HTMLInputElement>('#volume'), $<HTMLInputElement>('#dock-volume')]) control.addEventListener('input', () => { const value = Number(control.value) / 100; $<HTMLInputElement>('#volume').value = control.value; $<HTMLInputElement>('#dock-volume').value = control.value; if (gain && audioContext) gain.gain.setTargetAtTime(value, audioContext.currentTime, .03); song.volume = value; spotify.setVolume(value); $('#volume-label').textContent = `${Math.round(value * 100)}%`; });
$('#dock-toggle').addEventListener('click', () => { const kind = sound || lastSound; if (kind === 'spotify' && !spotify.canResume) openSpotify(); else selectSound(kind); });
function renderSpotify() {
  const connected = spotify.connected;
  $('#spotify-status').textContent = spotify.status || (!spotify.configured ? 'Spotify isn’t set up on this site yet.' : !connected ? 'Connect your Spotify account to play your own playlists here. Spotify Premium is needed for playback.' : spotify.track ? 'Your cat is listening along.' : 'Pick a playlist. Your cat will listen along.');
  $<HTMLButtonElement>('#spotify-connect').hidden = connected; $<HTMLButtonElement>('#spotify-connect').disabled = !spotify.configured;
  $('#spotify-disconnect').hidden = !connected; $('#spotify-playlists').hidden = !connected;
  $('#spotify-now').hidden = !connected || !spotify.track;
  $('#spotify-track').textContent = spotify.track ? `${spotify.track.name} — ${spotify.track.artists}` : '';
  $('#spotify-toggle').textContent = sound === 'spotify' ? 'Ⅱ' : '▶'; $('#spotify-toggle').setAttribute('aria-label', sound === 'spotify' ? 'Pause Spotify' : 'Play Spotify');
}
function spotifyProblem(error: unknown) { spotify.status = error instanceof Error ? error.message : 'Spotify isn’t responding right now. Please try again.'; renderSpotify(); }
let spotifyLoading = false;
async function loadSpotifyLibrary() {
  if (spotifyLoading) return; spotifyLoading = true;
  const list = $('#spotify-playlists'), note = document.createElement('li'); note.className = 'spotify-note'; note.textContent = 'Finding your playlists…'; list.replaceChildren(note);
  try {
    const collections = await spotify.collections();
    note.textContent = 'No playlists yet. Make one in Spotify, then come back.';
    list.replaceChildren(...(collections.length ? collections.map(item => {
      const li = document.createElement('li'), button = document.createElement('button'), cover = document.createElement(item.image ? 'img' : 'span'), text = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
      if (cover instanceof HTMLImageElement) { cover.src = item.image!; cover.alt = ''; cover.loading = 'lazy'; } cover.className = 'spotify-cover';
      name.textContent = item.name; detail.textContent = item.detail; text.append(name, detail); button.append(cover, text); button.setAttribute('aria-label', `Play ${item.name}`);
      button.addEventListener('click', () => playSpotify(item)); li.append(button); return li;
    }) : [note]));
  } catch (error) { list.replaceChildren(); spotifyProblem(error); }
  finally { spotifyLoading = false; }
}
async function playSpotify(item: SpotifyCollection) {
  try { if (sound !== 'spotify') stopSound(); await spotify.play(item); sound = 'spotify'; lastSound = 'spotify'; renderSound(); }
  catch (error) { spotifyProblem(error); }
}
function openSpotify() {
  spotify.status = ''; renderSpotify(); $<HTMLDialogElement>('#spotify').showModal();
  if (spotify.connected) { loadSpotifyLibrary(); spotify.prepare().catch(() => {}); }
}
for (const id of ['#spotify-open', '#dock-spotify']) $(id).addEventListener('click', openSpotify);
$('#spotify-connect').addEventListener('click', () => spotify.connect().catch(spotifyProblem));
$('#spotify-disconnect').addEventListener('click', () => { if (sound === 'spotify') stopSound(); spotify.disconnect(); renderSound(); });
$('#spotify-toggle').addEventListener('click', () => selectSound('spotify'));
$('#spotify-next').addEventListener('click', () => spotify.next().catch(spotifyProblem));
$('#spotify-prev').addEventListener('click', () => spotify.previous().catch(spotifyProblem));
spotify.setVolume(Number($<HTMLInputElement>('#volume').value) / 100);
spotify.completeSignIn().then(result => {
  if (result === null) return;
  if (result) openSpotify(); else toast('Spotify wasn’t connected. You can try again anytime.');
}).catch(error => toast(error instanceof Error ? error.message : 'Spotify sign-in didn’t finish.'));
$('#dock-own-song').addEventListener('click', () => $('#upload-song').click());
$('#upload-song').addEventListener('click', () => { if (songUrl) selectSound('own'); else $('#song-file').click(); });
$('#song-file').addEventListener('change', async () => {
  const file = $<HTMLInputElement>('#song-file').files?.[0]; if (!file) return;
  if (!file.type.startsWith('audio/')) { $<HTMLInputElement>('#song-file').value = ''; return toast('Please choose an audio file.'); }
  stopSound(); if (songUrl) URL.revokeObjectURL(songUrl); songUrl = URL.createObjectURL(file); song.src = songUrl;
  await selectSound('own'); if (sound === 'own') toast(`Playing ${file.name}. Your file stays on this device.`);
});
song.addEventListener('error', () => { if (sound === 'own') { stopSound(); renderSound(); toast('Your browser cannot play this file. Try MP3 or WAV.'); } if (songUrl) { URL.revokeObjectURL(songUrl); songUrl = null; $<HTMLInputElement>('#song-file').value = ''; } });
function chime() { if (!audioContext || audioContext.state !== 'running') return; const now = audioContext.currentTime; tone(523.25, now, .6, .12); tone(659.25, now + .2, .9, .12); }
window.addEventListener('pagehide', () => { account(Date.now()); save(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); react(0, catLine('return')); } });
window.addEventListener('cat-reaction', event => react(Number(event.detail?.frame) || 0, catLine(event.detail?.event || 'encourage'), 4200));
window.addEventListener('study-notice',event=>{if(typeof event.detail==='string')toast(event.detail);});
window.addEventListener('cat-style-change', event => {
 const next=normalizeStyle(event.detail);
 if(Object.values(CATS).some(cat=>cat.name===kittenName))kittenName=CATS[next.catId].name;
 catStyle=next;save();renderCat();
});
window.addEventListener('study-room-restore', event => {
  const value = event.detail;
  if (isRoomId(value?.room)) setRoom(value.room);
  if (value?.durations && PHASES.every(p => validMinutes(value.durations[p])) && !deadline && !sharedGuest) { Object.assign(durations,value.durations); seconds=durations[phase]*60; save(); renderTimer(); }
});
window.addEventListener('study-shared-timer', event => {
  const state = event.detail;
  if (!state || !PHASES.includes(state.phase) || !Number.isInteger(state.seconds) || state.seconds < 0 || state.seconds > 10800) return;
  account(Date.now());const shared=state.durations;if(shared&&PHASES.every(p=>validMinutes(shared[p])))Object.assign(durations,shared);phase = state.phase; seconds = state.seconds; deadline = state.running && seconds > 0 ? state.deadline||Date.now()+seconds*1000 : null; accountedUntil = Date.now(); save(); renderTimer();
});
window.addEventListener('study-shared-mode', event => {const wasGuest=sharedGuest;sharedGuest=!!event.detail;if(wasGuest&&!sharedGuest){account(Date.now());deadline=null;}for (const button of [$<HTMLButtonElement>('#start'),$<HTMLButtonElement>('#reset'),$<HTMLButtonElement>('#settings-open'),...all<HTMLButtonElement>('[data-phase]')]) button.disabled=sharedGuest;save();renderTimer();});
window.addEventListener('study-shared-active',event=>{if(sharedRoom&&!event.detail){account(Date.now());deadline=null;}sharedRoom=!!event.detail;sharedReady=true;save();});
window.addEventListener('study-snapshot-request', () => window.dispatchEvent(new CustomEvent('study-snapshot', {detail:{room,durations:{...durations},kittenName,phase,seconds,deadline}})));
// shortcut: tasks and preferences are saved on this browser only; add accounts when cross-device sync is required.
setRoom(room, false); renderTasks(); renderTimer(); tick(); installStudyFlow(room); setInterval(tick, 1000);
