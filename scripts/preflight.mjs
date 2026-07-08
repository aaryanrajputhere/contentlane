import { spawnSync } from 'node:child_process';

const errors = [];
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) errors.push(`Node.js 22.13+ is required; current version is ${process.versions.node}.`);

const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
if (docker.error?.code === 'ENOENT') errors.push('Docker is not installed or is not on PATH.');
else if (docker.status !== 0) errors.push(`Docker Compose is unavailable: ${(docker.stderr || docker.stdout).trim()}`);

if (errors.length > 0) {
  console.error('ReelSwarm setup prerequisites are missing:\n');
  for (const error of errors) console.error(`- ${error}`);
  console.error('\nInstall or upgrade these prerequisites, then rerun npm run setup.');
  process.exit(1);
}

console.log(`Preflight passed: Node ${process.versions.node}; ${docker.stdout.trim()}`);
