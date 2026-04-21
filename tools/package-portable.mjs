import { chmodSync, cpSync, createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { need as fetchPkgRuntime } from '@yao-pkg/pkg-fetch';

const require = createRequire(import.meta.url);
const tar = require('tar-fs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const releaseDir = resolve(projectRoot, 'release');
const builtMain = resolve(projectRoot, 'build', 'esm', 'main.js');

const targets = [
	{ id: 'linux-x64', runtimePlatform: 'linux', runtimeArch: 'x64', nodeName: 'node' },
	{ id: 'windows-x64', runtimePlatform: 'win', runtimeArch: 'x64', nodeName: 'node.exe' },
	{ id: 'macos-x64', runtimePlatform: 'macos', runtimeArch: 'x64', nodeName: 'node' },
	{ id: 'macos-arm64', runtimePlatform: 'macos', runtimeArch: 'arm64', nodeName: 'node' },
];

function usage() {
	return `Usage:
  node tools/package-portable.mjs [--target=<target>|--all] [--archive|--no-archive]

Targets:
  ${targets.map(target => target.id).join(', ')}
`;
}

function currentTargetId() {
	if (process.platform === 'win32') return 'windows-x64';
	if (process.platform === 'darwin') return process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
	return 'linux-x64';
}

function parseArgs(argv) {
	let all = false;
	let targetId = currentTargetId();
	let archive = true;
	for (const arg of argv) {
		if (arg === '--all') {
			all = true;
		} else if (arg.startsWith('--target=')) {
			targetId = arg.slice('--target='.length);
		} else if (arg === '--archive') {
			archive = true;
		} else if (arg === '--no-archive') {
			archive = false;
		} else if (arg === '--help' || arg === '-h') {
			console.log(usage());
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
		}
	}
	const selected = all ? targets : [targets.find(target => target.id === targetId)];
	if (selected.some(target => !target)) {
		throw new Error(`Unknown portable target: ${targetId}\n\n${usage()}`);
	}
	return { selected, archive };
}

function writeLaunchers(portableDir, target) {
	const posixLauncher = `#!/usr/bin/env sh
set -eu
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
"$DIR/runtime/${target.nodeName}" "$DIR/app/main.js" "$@"
`;

	const cmdLauncher = `@echo off
setlocal
set "DIR=%~dp0"
"%DIR%runtime\\node.exe" "%DIR%app\\main.js" %*
`;

	const psLauncher = `$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$dir\\runtime\\node.exe" "$dir\\app\\main.js" $args
`;

	const launcherPath = join(portableDir, 'poke-eval');
	writeFileSync(launcherPath, posixLauncher, 'utf8');
	chmodSync(launcherPath, 0o755);
	writeFileSync(join(portableDir, 'poke-eval.cmd'), cmdLauncher, 'utf8');
	writeFileSync(join(portableDir, 'poke-eval.ps1'), psLauncher, 'utf8');
}

function writeReadme(portableDir, target) {
	const readme = `# Portable package

This folder contains a self-contained runtime package for ${target.id}.

Double-click on Windows:
- poke-eval.cmd

Run from a terminal:
- macOS/Linux: ./poke-eval
- Windows cmd: poke-eval.cmd
- Windows PowerShell: ./poke-eval.ps1

The guided TUI opens by default. To use CLI mode, pass CLI flags from a terminal, for example:
- ./poke-eval --my=my-team.json --enemy=enemy-team.json --json
- poke-eval.cmd --my=my-team.json --enemy=enemy-team.json --json

Notes:
- Includes bundled Node runtime (${target.nodeName}).
- No global Node.js installation required on target machine.
`;
	writeFileSync(join(portableDir, 'README.txt'), readme, 'utf8');
}

async function runtimeForTarget(target) {
	const isCurrentRuntime =
		(target.runtimePlatform === 'win' && process.platform === 'win32' && target.runtimeArch === process.arch) ||
		(target.runtimePlatform === 'macos' && process.platform === 'darwin' && target.runtimeArch === process.arch) ||
		(target.runtimePlatform === 'linux' && process.platform === 'linux' && target.runtimeArch === process.arch);

	if (isCurrentRuntime) return process.execPath;
	return fetchPkgRuntime({
		nodeRange: 'node22',
		platform: target.runtimePlatform,
		arch: target.runtimeArch,
	});
}

async function archivePortable(portableDir, target) {
	const archivePath = join(releaseDir, `poke-eval-portable-${target.id}.tar.gz`);
	rmSync(archivePath, { force: true });
	await pipeline(
		tar.pack(releaseDir, { entries: [basename(portableDir)] }),
		createGzip({ level: 9 }),
		createWriteStream(archivePath),
	);
	console.log(`Portable archive created: ${archivePath}`);
}

async function buildPortable(target, archive) {
	const portableName = `portable-${target.id}`;
	const portableDir = join(releaseDir, portableName);
	const runtimeDir = join(portableDir, 'runtime');
	const appDir = join(portableDir, 'app');
	const runtimePath = await runtimeForTarget(target);

	rmSync(portableDir, { recursive: true, force: true });
	mkdirSync(runtimeDir, { recursive: true });
	mkdirSync(appDir, { recursive: true });

	cpSync(runtimePath, join(runtimeDir, target.nodeName));
	if (target.runtimePlatform !== 'win') chmodSync(join(runtimeDir, target.nodeName), 0o755);
	cpSync(resolve(projectRoot, 'build', 'esm'), appDir, { recursive: true });
	cpSync(resolve(projectRoot, 'node_modules'), join(appDir, 'node_modules'), { recursive: true });

	writeFileSync(
		join(appDir, 'package.json'),
		JSON.stringify({ name: 'poke-eval-portable', private: true, type: 'module' }, null, 2) + '\n',
		'utf8',
	);

	writeLaunchers(portableDir, target);
	writeReadme(portableDir, target);
	console.log(`Portable package created: ${portableDir}`);
	if (archive) await archivePortable(portableDir, target);
}

if (!existsSync(builtMain)) {
	throw new Error('Missing build/esm/main.js. Run `npm run build:bundle` first.');
}

mkdirSync(releaseDir, { recursive: true });
const { selected, archive } = parseArgs(process.argv.slice(2));
for (const target of selected) {
	await buildPortable(target, archive);
}
