import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CACHE } from './data.js';
import { evaluateTeams as evaluateTeamsCompat } from './evaluation.js';
import { evaluateTeams } from './evaluation/index.js';
import type { MoveEntry, PokemonSet, SpeciesEntry } from './types.js';

function resetDataCache(): void {
	delete DATA_CACHE.species;
	delete DATA_CACHE.moves;
	delete DATA_CACHE.abilities;
	delete DATA_CACHE.items;
}

function seedDataCache(): void {
	const species: Record<string, SpeciesEntry> = {
		pikachu: { name: 'Pikachu', types: ['Electric'], baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 } },
		bulbasaur: { name: 'Bulbasaur', types: ['Grass', 'Poison'], baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 } },
		charmander: { name: 'Charmander', types: ['Fire'], baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 } },
		squirtle: { name: 'Squirtle', types: ['Water'], baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 } },
		geodude: { name: 'Geodude', types: ['Rock', 'Ground'], baseStats: { hp: 40, atk: 80, def: 100, spa: 30, spd: 30, spe: 20 } },
		gastly: { name: 'Gastly', types: ['Ghost', 'Poison'], baseStats: { hp: 30, atk: 35, def: 30, spa: 100, spd: 35, spe: 80 } },
	};

	const moves: Record<string, MoveEntry> = {
		thunderbolt: { name: 'Thunderbolt', type: 'Electric', basePower: 90, category: 'Special', accuracy: 100, priority: 0 },
		vinewhip: { name: 'Vine Whip', type: 'Grass', basePower: 45, category: 'Physical', accuracy: 100, priority: 0 },
		ember: { name: 'Ember', type: 'Fire', basePower: 40, category: 'Special', accuracy: 100, priority: 0 },
		watergun: { name: 'Water Gun', type: 'Water', basePower: 40, category: 'Special', accuracy: 100, priority: 0 },
		tackle: { name: 'Tackle', type: 'Normal', basePower: 40, category: 'Physical', accuracy: 100, priority: 0 },
		shadowball: { name: 'Shadow Ball', type: 'Ghost', basePower: 80, category: 'Special', accuracy: 100, priority: 0 },
		fakeout: { name: 'Fake Out', type: 'Normal', basePower: 40, category: 'Physical', accuracy: 100, priority: 3 },
		protect: { name: 'Protect', type: 'Normal', basePower: 0, category: 'Status', accuracy: true, priority: 4 },
	};

	DATA_CACHE.species = species;
	DATA_CACHE.moves = moves;
	DATA_CACHE.abilities = {};
	DATA_CACHE.items = {};
}

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

test('evaluateTeams throws when data cache is not initialized', () => {
	resetDataCache();
	assert.throws(
		() => evaluateTeams([set('Pikachu', ['Thunderbolt'])], [set('Squirtle', ['Water Gun'])]),
		/Data not loaded; call loadData\(\) first/,
	);
});

test('singles evaluation returns sorted entries with hazard switch-in notes', () => {
	seedDataCache();
	const myTeam = [
		set('Pikachu', ['Thunderbolt', 'Tackle']),
		set('Bulbasaur', ['Vine Whip', 'Tackle']),
	];
	const enemyTeam = [set('Squirtle', ['Water Gun', 'Tackle'])];
	const result = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'singles',
		allowSwitching: true,
		battleState: {
			weather: 'none',
			terrain: 'none',
			mySide: { stealthRock: true, spikesLayers: 1 },
			enemySide: {},
		},
	});

	const entries = result.Squirtle;
	assert.equal(entries.length, 2);
	assert.ok(entries[0].score >= entries[1].score);
	assert.ok(entries.every((entry) => entry.confidence !== undefined));
	assert.ok(entries.every((entry) => entry.rationale && entry.rationale.length > 0));
	assert.ok(entries.every((entry) => entry.notes?.some(note => note.includes('Switch-in hazards estimate'))));
});

test('doubles evaluation returns lead-pair results and applies combined hazard penalty note', () => {
	seedDataCache();
	const myTeam = [
		set('Pikachu', ['Thunderbolt', 'Fake Out']),
		set('Bulbasaur', ['Vine Whip', 'Protect']),
		set('Gastly', ['Shadow Ball', 'Protect']),
	];
	const enemyTeam = [
		set('Charmander', ['Ember', 'Tackle']),
		set('Squirtle', ['Water Gun', 'Tackle']),
	];

	const result = evaluateTeams(myTeam, enemyTeam, {
		battleFormat: 'doubles',
		allowSwitching: true,
		battleState: {
			weather: 'none',
			terrain: 'none',
			mySide: { stealthRock: true, spikesLayers: 2 },
			enemySide: {},
		},
	});

	const key = 'Charmander + Squirtle';
	assert.ok(result[key]);
	assert.equal(result[key].length, 3);
	assert.ok(result[key][0].score >= result[key][1].score);
	assert.ok(result[key][1].score >= result[key][2].score);
	assert.ok(result[key].every((entry) => entry.pokemon.includes(' + ')));
	assert.ok(result[key].some((entry) => entry.notes?.some((note) => note.includes('Lead switch-in hazards estimate'))));
});

test('compatibility wrapper re-export matches evaluation module entrypoint output', () => {
	seedDataCache();
	const myTeam = [set('Pikachu', ['Thunderbolt']), set('Geodude', ['Tackle'])];
	const enemyTeam = [set('Squirtle', ['Water Gun'])];
	const options = { battleFormat: 'singles' as const, mode: 'competitive' as const };
	const direct = evaluateTeams(myTeam, enemyTeam, options);
	const wrapped = evaluateTeamsCompat(myTeam, enemyTeam, options);
	assert.deepEqual(wrapped, direct);
});
