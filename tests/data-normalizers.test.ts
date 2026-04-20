import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAbilities } from '../src/data/normalize-abilities.js';
import { normalizeItems } from '../src/data/normalize-items.js';
import { normalizeMoves } from '../src/data/normalize-moves.js';
import { addPokeAPISpeciesEntry, normalizeShowdownSpecies } from '../src/data/normalize-species.js';
import type { SpeciesEntry } from '../src/types.js';

test('normalizeShowdownSpecies adds canonical and id aliases', () => {
	const species: Record<string, SpeciesEntry> = {};
	normalizeShowdownSpecies(species, {
		pikachu: {
			name: 'Pikachu',
			types: ['Electric'],
			baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
			abilities: { 0: 'Static' },
		},
	});

	assert.ok(species.pikachu);
	assert.equal(species.pikachu.name, 'Pikachu');
	assert.equal(species.pikachu.defaultAbility, 'Static');
	assert.equal(species.pikachu.types[0], 'Electric');
});

test('addPokeAPISpeciesEntry maps formatted name, sorted types, and aliases', () => {
	const species: Record<string, SpeciesEntry> = {};
	addPokeAPISpeciesEntry(species, {
		name: 'deoxys',
		resolved_name: 'deoxys-normal',
		types: [
			{ slot: 2, type: { name: 'flying' } },
			{ slot: 1, type: { name: 'psychic' } },
		],
		stats: [
			{ stat: { name: 'hp' }, base_stat: 50 },
			{ stat: { name: 'attack' }, base_stat: 150 },
			{ stat: { name: 'defense' }, base_stat: 50 },
			{ stat: { name: 'special-attack' }, base_stat: 150 },
			{ stat: { name: 'special-defense' }, base_stat: 50 },
			{ stat: { name: 'speed' }, base_stat: 150 },
		],
	});

	assert.ok(species.deoxys);
	assert.ok(species.deoxysnormal);
	assert.equal(species.deoxys.name, 'Deoxys');
	assert.deepEqual(species.deoxys.types, ['Psychic', 'Flying']);
	assert.equal(species.deoxys.baseStats.spa, 150);
});

test('normalizeMoves maps keys and derived move fields', () => {
	const moves = normalizeMoves({
		surgingstrikes: {
			name: 'Surging Strikes',
			type: 'Water',
			basePower: 25,
			category: 'Physical',
			accuracy: 100,
			willCrit: true,
			critRatio: 2,
			multihit: [3, 3],
			multiaccuracy: true,
			priority: 0,
			recoil: false,
			drain: false,
			self: { boosts: { atk: 1 } },
			maxMove: { basePower: 130 },
		},
	});

	assert.ok(moves['surging strikes']);
	assert.ok(moves.surgingstrikes);
	assert.equal(moves.surgingstrikes.maxMoveBasePower, 130);
	assert.deepEqual(moves.surgingstrikes.multiHit, [3, 3]);
	assert.equal(moves.surgingstrikes.setupBoosts?.atk, 1);
});

test('normalizeAbilities maps known flags and immunities', () => {
	const abilities = normalizeAbilities({
		levitate: { name: 'Levitate' },
		hugepower: { name: 'Huge Power' },
		technician: { name: 'Technician' },
		adaptability: { name: 'Adaptability' },
	});

	assert.deepEqual(abilities.levitate.immuneTo, ['Ground']);
	assert.equal(abilities['huge power'].doubleAttack, true);
	assert.equal(abilities.technician.technician, true);
	assert.equal(abilities.adaptability.adaptability, true);
});

test('normalizeItems maps known multipliers', () => {
	const items = normalizeItems({
		choiceband: { name: 'Choice Band' },
		lifeorb: { name: 'Life Orb' },
		expertbelt: { name: 'Expert Belt' },
	});

	assert.equal(items['choice band'].attackMult, 1.5);
	assert.equal(items['life orb'].damageMult, 1.3);
	assert.equal(items['expert belt'].superEffectiveMult, 1.2);
});
