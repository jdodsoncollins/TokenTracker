/**
 * Offline manual smoke gate: typecheck + unit tests with coverage.
 * No network, no secrets, no device required.
 *
 *   npm run smoke
 *
 * Device check (separate): npm start → Expo Go / emulator / web.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

console.log('TokenTracker manual smoke (offline)');
run('npm', ['run', 'typecheck']);
run('npm', ['run', 'test:coverage']);
console.log('\nManual smoke OK: typecheck + coverage suite passed.');
console.log(
  'Next (device): npm start → open Expo Go / Android / iOS / web; add keys only on-device.',
);
