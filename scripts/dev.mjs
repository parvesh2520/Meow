// Local dev: writes js/config.mjs, runs tsc in watch mode, and serves the site at http://localhost:3000.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve} from 'node:path';

await import('./write-config.mjs');
spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--watch', '--preserveWatchOutput'], {stdio: 'inherit'});

const root = resolve('.');
const port = Number(process.env.PORT) || 3000;
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml'};

createServer(async (req, res) => {
  let file = join(root, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, {'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the other server or run with PORT=3001.` : e);
  process.exit(1);
}).listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`Serving at ${url}  (Ctrl+C to stop)`);
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  spawn(cmd, args, {stdio: 'ignore', detached: true}).on('error', () => {}).unref();
});
