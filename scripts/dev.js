// Starts everything needed for local development:
//   1. a persistent local MongoDB (backend/.data/db) on :27017   — skipped with --memory or --no-db
//   2. the backend API on :3000 (waits for MongoDB first)
//   3. the Angular dev server on :4200 (proxies API calls to the backend)
// Usage: npm run dev                 -> all three, data persists between runs
//        npm run dev -- --memory     -> throwaway in-memory MongoDB instead (nothing saved)
//        npm run dev -- --no-db      -> use MONGODB_URI from backend/.env as-is (e.g. Atlas or your own mongod)
//        BACKEND_PORT=3001 FRONTEND_PORT=4201 MONGO_PORT=27018 npm run dev   -> custom ports
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const memory = args.includes('--memory');
const ownDb = !memory && !args.includes('--no-db');
const backendPort = process.env.BACKEND_PORT || '3000';
const frontendPort = process.env.FRONTEND_PORT || '4200';
const mongoPort = process.env.MONGO_PORT || '27017';

// The Angular dev server also honours PORT, so only the backend gets it.
const { PORT: _ignored, ...baseEnv } = process.env;
const procs = [];
let stopping = false;

function run(name, npmArgs, env) {
  const child = spawn('npm', npmArgs, { cwd: root, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (chunk) => chunk.toString().replace(/^(?=.)/gm, `[${name}] `);
  child.stdout.on('data', (d) => process.stdout.write(prefix(d)));
  child.stderr.on('data', (d) => process.stderr.write(prefix(d)));
  child.on('exit', (code) => {
    if (stopping) return;
    console.log(`[${name}] exited with code ${code}`);
    shutdown(code ?? 0);
  });
  procs.push(child);
  return child;
}

function waitForPort(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(Number(port), '127.0.0.1');
      socket.once('connect', () => { socket.end(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`MongoDB did not start on port ${port}`));
        else setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

// Kills a child and everything it started (npm -> node). On Windows, kill() would only stop the shell wrapper.
function killTree(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  procs.forEach(killTree);
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  const backendEnv = { ...baseEnv, PORT: backendPort };
  if (ownDb) {
    run('db', ['--prefix', 'backend', 'run', 'db'], { ...baseEnv, MONGO_PORT: mongoPort });
    await waitForPort(mongoPort);
    backendEnv.MONGODB_URI = `mongodb://127.0.0.1:${mongoPort}/bloggerbytes`;
  }
  run('backend', ['--prefix', 'backend', 'run', memory ? 'dev:memory' : 'dev'], backendEnv);
  run('frontend', ['--prefix', 'frontend', 'start', '--', '--port', frontendPort], { ...baseEnv, BACKEND_PORT: backendPort });
})().catch((err) => {
  console.error(err.message);
  shutdown(1);
});
