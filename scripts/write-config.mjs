// Writes js/config.mjs from the SPOTIFY_CLIENT_ID environment variable (set it in Vercel),
// falling back to a git-ignored .env.local for local builds, so the ID never lives in the repository.
import {mkdirSync, writeFileSync} from 'node:fs';

try { process.loadEnvFile('.env.local'); } catch {}
const id = (process.env.SPOTIFY_CLIENT_ID || '').trim();
if (id && !/^[a-f0-9]{32}$/i.test(id)) throw Error('SPOTIFY_CLIENT_ID must be the 32-character Client ID from the Spotify dashboard.');
if (!id) console.warn('SPOTIFY_CLIENT_ID is not set; the Spotify button will say it is not set up.');
mkdirSync('js', {recursive: true});
writeFileSync('js/config.mjs', `export const SPOTIFY_CLIENT_ID = ${JSON.stringify(id)};\n`);
