import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock } from 'node:test';

import { evaluateTeams } from '../src/evaluation/index.js';
import { runCli } from '../src/cli.js';
import { resetDataCache, setActiveGeneration, setDataCache } from '../src/data.js';
import type { MoveEntry, PokemonSet, SpeciesEntry } from '../src/types.js';

function set(species: string, moves: string[]): PokemonSet {
	return {
		species,
		level: 50,
		nature: 'Hardy',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
		moves,
	};
}

function seedCache(): void {
	setActiveGeneration(9);
	const species: Record<string, SpeciesEntry> = {
		pikachu: { name: 'Pikachu', types: ['Electric'], baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 } },
		bulbasaur: { name: 'Bulbasaur', types: ['Grass', 'Poison'], baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 } },
		squirtle: { name: 'Squirtle', types: ['Water'], baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 } },
	};
	const moves: Record<string, MoveEntry> = {
		thunderbolt: { name: 'Thunderbolt', type: 'Electric', basePower: 90, category: 'Special', accuracy: 100, priority: 0 },
		vinewhip: { name: 'Vine Whip', type: 'Grass', basePower: 45, category: 'Physical', accuracy: 100, priority: 0 },
		watergun: { name: 'Water Gun', type: 'Water', basePower: 40, category: 'Special', accuracy: 100, priority: 0 },
		tackle: { name: 'Tackle', type: 'Normal', basePower: 40, category: 'Physical', accuracy: 100, priority: 0 },
	};
	setDataCache({
		species,
		moves,
		abilities: {},
		items: {},
	});
}

test('golden: evaluateTeams maintains expected top ordering for fixed fixture', () => {
	seedCache();
	const result = evaluateTeams(
		[set('Pikachu', ['Thunderbolt', 'Tackle']), set('Bulbasaur', ['Vine Whip', 'Tackle'])],
		[set('Squirtle', ['Water Gun', 'Tackle'])],
		{ battleFormat: 'singles', mode: 'competitive' },
	);
	assert.equal(result.Squirtle[0].pokemon, 'Pikachu');
	assert.equal(result.Squirtle[0].move, 'Thunderbolt');
	assert.ok(result.Squirtle[0].score > result.Squirtle[1].score);
	resetDataCache();
});

test('golden: CLI --json output keeps stable shape for single-enemy fixture', async () => {
	seedCache();
	const dir = mkdtempSync(join(tmpdir(), 'poke-eval-cli-golden-'));
	const myPath = join(dir, 'my-team.txt');
	const enemyPath = join(dir, 'enemy-team.txt');
	writeFileSync(myPath, 'Pikachu\n- Thunderbolt\n');
	writeFileSync(enemyPath, 'Squirtle\n- Water Gun\n');

	const argvBefore = process.argv;
	const logs: string[] = [];
	mock.method(console, 'log', (...args: unknown[]) => {
		logs.push(args.map(String).join(' '));
	});
	try {
		process.argv = ['node', 'src/main.ts', `--my=${myPath}`, `--enemy=${enemyPath}`, '--json'];
		await runCli();
		const jsonText = logs.find((line) => line.trim().startsWith('{') && line.trim().endsWith('}'));
		assert.ok(jsonText, 'CLI should print JSON when --json is provided');
		const parsed = JSON.parse(jsonText!);
		assert.ok(Array.isArray(parsed.Squirtle));
		assert.equal(typeof parsed.Squirtle[0].pokemon, 'string');
		assert.equal(typeof parsed.Squirtle[0].score, 'number');
	} finally {
		process.argv = argvBefore;
		mock.restoreAll();
		rmSync(dir, { recursive: true, force: true });
		resetDataCache();
	}
});
