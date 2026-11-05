// Connects a listener's Spotify account (Authorization Code + PKCE, so no client secret) and plays
// through the Spotify Web Playback SDK, which turns this tab into a Spotify Connect device.
// Setup: create an app at developer.spotify.com, set its Client ID as SPOTIFY_CLIENT_ID (Vercel env var or .env.local), and add
// https://studywithcat.online/ (plus http://127.0.0.1:<port>/ for local testing) as redirect URIs.
import {SPOTIFY_CLIENT_ID} from './config.mjs';
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read';
const TOKEN_KEY = 'swc-spotify-v1', SIGN_IN_KEY = 'swc-spotify-sign-in';
const redirectUri = () => `${location.origin}/`;

interface Tokens {accessToken: string; refreshToken: string; expiresAt: number}
export interface SpotifyCollection {name: string; detail: string; image?: string; play: {context_uri: string} | {uris: string[]}}
export interface SpotifyTrack {name: string; artists: string}

function storedTokens(): Tokens | null {
  try {
    const value = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    return typeof value?.accessToken === 'string' && typeof value.refreshToken === 'string' && Number.isFinite(value.expiresAt) ? value : null;
  } catch { return null; }
}
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomText = (size: number) => base64url(crypto.getRandomValues(new Uint8Array(size)));
const imageUrl = (value: unknown) => typeof value === 'string' && value.startsWith('https://') ? value : undefined;

export class SpotifyConnection {
  playing = false;
  track: SpotifyTrack | null = null;
  status = '';
  private tokens = storedTokens();
  private refreshing: Promise<string> | null = null;
  private player: Spotify.Player | null = null;
  private device: Promise<string> | null = null;
  private volume = .35;

  constructor(private onChange: () => void) {}
  get configured(): boolean { return !!SPOTIFY_CLIENT_ID; }
  get connected(): boolean { return !!this.tokens; }
  get canResume(): boolean { return !!this.track && !!this.player; }

  async connect(): Promise<void> {
    if (!this.configured) throw Error('Spotify isn’t set up on this site yet.');
    const verifier = randomText(48), state = randomText(16);
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    sessionStorage.setItem(SIGN_IN_KEY, JSON.stringify({verifier, state}));
    location.assign(`https://accounts.spotify.com/authorize?${new URLSearchParams({client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: redirectUri(), scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge})}`);
  }

  // Finishes the redirect back from Spotify. Returns null when this page load is not a Spotify redirect.
  async completeSignIn(): Promise<boolean | null> {
    const params = new URLSearchParams(location.search), code = params.get('code'), state = params.get('state');
    if (!state || (!code && !params.has('error'))) return null;
    let saved: {verifier?: unknown; state?: unknown} = {};
    try { saved = JSON.parse(sessionStorage.getItem(SIGN_IN_KEY) || '{}') ?? {}; sessionStorage.removeItem(SIGN_IN_KEY); } catch {}
    for (const key of ['code', 'state', 'error']) params.delete(key);
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    // The state check rejects sign-in responses this browser did not start.
    if (!code || saved.state !== state || typeof saved.verifier !== 'string') return false;
    await this.requestTokens({grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: saved.verifier});
    this.onChange();
    return true;
  }

  disconnect(): void {
    this.player?.disconnect();
    this.player = null; this.device = null; this.track = null; this.playing = false; this.status = '';
    this.forget();
    this.onChange();
  }

  async collections(): Promise<SpotifyCollection[]> {
    const [playlists, liked] = await Promise.all([this.api('/me/playlists?limit=50'), this.api('/me/tracks?limit=50')]);
    const list: SpotifyCollection[] = [];
    const likedUris: string[] = (liked?.items ?? []).map((item: any) => item?.track?.uri).filter((uri: unknown) => typeof uri === 'string');
    if (likedUris.length) list.push({name: 'Liked Songs', detail: 'Your latest liked songs', play: {uris: likedUris}});
    for (const playlist of playlists?.items ?? []) {
      if (typeof playlist?.uri !== 'string') continue;
      const total = playlist.tracks?.total ?? playlist.items?.total;
      list.push({name: String(playlist.name || 'Untitled playlist'), detail: Number.isInteger(total) ? `${total} songs` : 'Playlist', image: imageUrl(playlist.images?.[0]?.url), play: {context_uri: playlist.uri}});
    }
    return list;
  }

  // Starts the in-tab player early so the first play is quick and errors such as a free account show up front.
  prepare(): Promise<string> {
    return this.device ||= new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => fail('Spotify took too long to connect. Please try again.'), 20000);
      const fail = (message: string) => {
        clearTimeout(timer);
        this.player?.disconnect(); this.player = null; this.device = null; this.playing = false; this.status = message;
        reject(Error(message)); this.onChange();
      };
      const start = () => {
        this.player?.disconnect();
        const player = new window.Spotify.Player({name: 'Study With Cat', volume: this.volume, getOAuthToken: done => { this.token().then(done, () => {}); }});
        this.player = player;
        player.addListener('ready', ({device_id}) => { clearTimeout(timer); resolve(device_id); });
        player.addListener('not_ready', () => { this.device = null; this.playing = false; this.onChange(); });
        player.addListener('initialization_error', () => fail('This browser can’t play Spotify here. Try Chrome, Edge, Firefox or Safari on a computer.'));
        player.addListener('authentication_error', () => { this.forget(); fail('Your Spotify sign-in expired. Connect Spotify again.'); });
        player.addListener('account_error', () => fail('Playing Spotify here needs Spotify Premium.'));
        player.addListener('playback_error', () => { this.status = 'Spotify couldn’t play that. Try another playlist.'; this.onChange(); });
        player.addListener('player_state_changed', state => {
          const current = state?.track_window.current_track;
          this.track = current ? {name: current.name, artists: current.artists.map(artist => artist.name).join(', ')} : null;
          this.playing = !!state && !state.paused;
          this.onChange();
        });
        player.connect().then(ok => { if (!ok) fail('Spotify couldn’t connect. Please try again.'); });
      };
      if (window.Spotify) return start();
      window.onSpotifyWebPlaybackSDKReady = start;
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.onerror = () => { script.remove(); fail('Spotify’s player couldn’t load. Check your connection.'); };
      document.head.append(script);
    });
  }

  async play(collection: SpotifyCollection): Promise<void> {
    void this.player?.activateElement();
    const deviceId = await this.prepare();
    await this.api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {method: 'PUT', body: JSON.stringify(collection.play)});
    this.playing = true; this.status = ''; this.onChange();
  }
  async resume(): Promise<void> {
    if (!this.player) throw Error('Choose a Spotify playlist first.');
    void this.player.activateElement();
    await this.player.resume(); this.playing = true; this.onChange();
  }
  async pause(): Promise<void> { this.playing = false; await this.player?.pause(); }
  async next(): Promise<void> { await this.player?.nextTrack(); }
  async previous(): Promise<void> { await this.player?.previousTrack(); }
  setVolume(volume: number): void { this.volume = volume; void this.player?.setVolume(volume); }

  private async api(path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.token();
    const response = await fetch(`https://api.spotify.com/v1${path}`, {...init, headers: {Authorization: `Bearer ${token}`, ...(init.body ? {'Content-Type': 'application/json'} : {})}, signal: AbortSignal.timeout(15000)});
    if (response.status === 401) { this.forget(); this.onChange(); throw Error('Your Spotify sign-in expired. Connect Spotify again.'); }
    if (response.status === 403) throw Error('Spotify didn’t allow this. Playing music here needs Spotify Premium.');
    if (response.status === 404) throw Error('Spotify couldn’t find this player. Close and reopen Spotify, then try again.');
    if (!response.ok) throw Error('Spotify isn’t responding right now. Please try again.');
    return response.status === 204 ? null : response.json().catch(() => null);
  }

  private token(): Promise<string> {
    // Another tab may already have refreshed (Spotify rotates refresh tokens), so prefer the newest stored pair.
    const stored = storedTokens();
    if (stored && (!this.tokens || stored.expiresAt > this.tokens.expiresAt)) this.tokens = stored;
    const tokens = this.tokens;
    if (!tokens) return Promise.reject(Error('Connect Spotify first.'));
    if (Date.now() < tokens.expiresAt - 60000) return Promise.resolve(tokens.accessToken);
    return this.refreshing ||= this.requestTokens({grant_type: 'refresh_token', refresh_token: tokens.refreshToken}).finally(() => { this.refreshing = null; });
  }

  private async requestTokens(body: Record<string, string>): Promise<string> {
    const response = await fetch('https://accounts.spotify.com/api/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: SPOTIFY_CLIENT_ID, ...body}), signal: AbortSignal.timeout(15000)});
    const value = await response.json().catch(() => null);
    if (!response.ok || typeof value?.access_token !== 'string') {
      if (response.status === 400) { this.forget(); this.onChange(); }
      throw Error('Spotify sign-in didn’t finish. Connect Spotify again.');
    }
    this.tokens = {accessToken: value.access_token, refreshToken: typeof value.refresh_token === 'string' ? value.refresh_token : this.tokens?.refreshToken ?? '', expiresAt: Date.now() + (Number(value.expires_in) || 3600) * 1000};
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(this.tokens)); } catch {}
    return this.tokens.accessToken;
  }

  private forget(): void {
    // Only clear storage that still holds our pair, so a rejected stale token never signs out a fresher tab.
    if (storedTokens()?.refreshToken === this.tokens?.refreshToken) try { localStorage.removeItem(TOKEN_KEY); } catch {}
    this.tokens = null;
  }
}
