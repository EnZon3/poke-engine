import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DATA_CACHE, loadData, resolveSpecies, setActiveGeneration } from '../src/data.js';
import { scenarios } from '../src/benchmark-scenarios.js';
import { evaluateTeams as evaluateTeamsCompat, hazardSwitchInFraction as hazardCompat } from '../src/evaluation.js';
import { evaluateTeams, hazardSwitchInFraction as hazardDirect } from '../src/evaluation/index.js';
import { isMain, runCli } from '../src/cli.js';
import { loadTeamInputFile, parseShowdownTeam, parseTeamInput } from '../src/team-import.js';
import { buildResultsViewModel } from '../src/tui/view-model.js';
import type { CliResult } from '../src/types.js';

test('data module public surface exports expected entrypoints', () => {
	assert.equal(typeof loadData, 'function');
	assert.equal(typeof resolveSpecies, 'function');
	assert.equal(typeof setActiveGeneration, 'function');
	assert.equal(typeof DATA_CACHE, 'object');
});

test('team-import public surface entrypoint matches parseTeamInput behavior', () => {
	const dir = mkdtempSync(join(tmpdir(), 'poke-engine-team-import-'));
	const file = join(dir, 'team.json');
	const jsonText = '[{"species":"Pikachu","level":50,"nature":"Serious","ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"evs":{"hp":0,"atk":0,"def":0,"spa":252,"spd":4,"spe":252},"moves":["Thunderbolt"]}]';
	writeFileSync(file, jsonText);
	try {
		const fromFile = loadTeamInputFile(file);
		const fromText = parseTeamInput(jsonText);
		assert.deepEqual(fromFile, fromText);
		assert.equal(parseShowdownTeam('Pikachu\n- Thunderbolt\n').length, 1);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('evaluation compatibility wrapper re-exports the same public functions', () => {
	assert.equal(evaluateTeamsCompat, evaluateTeams);
	assert.equal(hazardCompat, hazardDirect);
});

test('benchmark scenarios export remains usable for benchmark runner', () => {
	assert.ok(Array.isArray(scenarios));
	assert.ok(scenarios.length > 0);
	assert.ok(scenarios.every((scenario) => Array.isArray(scenario.myTeam) && Array.isArray(scenario.enemy)));
});

test('tui view-model export builds stable card fields for a minimal result set', () => {
	const result: CliResult = {
		'Enemy A': [
			{
				pokemon: 'Pikachu',
				move: 'Thunderbolt',
				score: 0.42,
				oneHkoChance: 0.1,
				twoHkoChance: 0.9,
				speedAdvantage: true,
				role: 'balanced',
				confidence: 'Medium',
				notes: ['Auto gimmick timing selected: now.', 'Opponent best response assumes: base.'],
			},
		],
	};
	const vm = buildResultsViewModel(result, 0, null, 120, 40);
	assert.equal(vm.entriesCount, 1);
	assert.equal(vm.cards.length, 1);
	assert.equal(vm.cards[0].enemy, 'Enemy A');
	assert.equal(vm.cards[0].isSelected, true);
	assert.ok(vm.cards[0].noteLine.includes('Auto gimmick timing selected'));
});

test('cli module exports callable entrypoints', () => {
	assert.equal(typeof runCli, 'function');
	assert.equal(typeof isMain(), 'boolean');
});

