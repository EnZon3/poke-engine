import test from 'node:test';
import assert from 'node:assert/strict';
import type { BattlePokemon, MoveEntry } from '../types.js';
import {
	aggregateOpponentResponse,
	applyBoostDelta,
	clampStage,
	confidenceFromSignals,
	defensiveReliabilityScore,
	hazardSwitchInFraction,
	modePreset,
	pairCombinations,
	setupBoostDelta,
	stageMultiplier,
} from './helpers.js';

function makeMove(overrides: Partial<MoveEntry> = {}): MoveEntry {
	return {
		name: 'Tackle',
		type: 'Normal',
		basePower: 40,
		category: 'Physical',
		accuracy: 100,
		priority: 0,
		...overrides,
	};
}

function makePokemon(name: string, overrides: Partial<BattlePokemon> = {}): BattlePokemon {
	return {
		species: {
			name,
			types: ['Normal'],
			baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
		},
		level: 50,
		nature: 'Hardy',
		stats: { hp: 200, atk: 120, def: 120, spa: 120, spd: 120, spe: 100 },
		moves: [makeMove()],
		status: null,
		...overrides,
	};
}

test('stageMultiplier and clampStage clamp expected stat stages', () => {
	assert.equal(stageMultiplier(99), 4);
	assert.equal(stageMultiplier(-99), 0.25);
	assert.equal(stageMultiplier(2), 2);
	assert.equal(stageMultiplier(-2), 0.5);
	assert.equal(clampStage(10), 6);
	assert.equal(clampStage(-10), -6);
});

test('modePreset resolves defaults and explicit overrides', () => {
	assert.deepEqual(modePreset({ mode: 'competitive' }), {
		lookaheadTurns: 3,
		defensiveWeight: 0.4,
		opponentRiskWeight: 0.65,
	});
	assert.deepEqual(modePreset({ mode: 'casual' }), {
		lookaheadTurns: 2,
		defensiveWeight: 0.22,
		opponentRiskWeight: 0.5,
	});
	assert.deepEqual(modePreset({ mode: 'custom', lookaheadTurns: 1, defensiveWeight: 0.9, opponentRiskWeight: 0.2 }), {
		lookaheadTurns: 1,
		defensiveWeight: 0.9,
		opponentRiskWeight: 0.2,
	});
});

test('confidenceFromSignals reflects score/reliability and setup volatility', () => {
	const strongProfile = {
		min: 50,
		max: 100,
		expected: 75,
		hitChance: 1,
		oneHkoChance: 0.8,
		twoHkoChance: 0.95,
		distribution: [{ damage: 75, prob: 1 }],
	};
	assert.equal(confidenceFromSignals(0.8, strongProfile, []), 'High');
	assert.equal(confidenceFromSignals(0.5, strongProfile, ['Setup discovered: Dragon Dance.']), 'Medium');
	assert.equal(confidenceFromSignals(0.1, undefined, []), 'Low');
});

test('hazardSwitchInFraction handles type effects and grounded spikes', () => {
	const groundedRockWeak = makePokemon('Charizard', { species: { name: 'Charizard', types: ['Fire', 'Flying'], baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 } } });
	const groundedNeutral = makePokemon('Snorlax', { species: { name: 'Snorlax', types: ['Normal'], baseStats: { hp: 160, atk: 110, def: 65, spa: 65, spd: 110, spe: 30 } } });
	const teraGrounded = makePokemon('Dragonite', { species: { name: 'Dragonite', types: ['Dragon', 'Flying'], baseStats: { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 } }, teraType: 'Steel' });

	assert.equal(hazardSwitchInFraction(groundedRockWeak, { stealthRock: true, spikesLayers: 3 }), 0.5);
	assert.equal(hazardSwitchInFraction(groundedNeutral, { stealthRock: true, spikesLayers: 2 }), (1 / 8) + (1 / 6));
	assert.equal(hazardSwitchInFraction(teraGrounded, { spikesLayers: 1 }), 1 / 8);
	assert.equal(hazardSwitchInFraction(groundedNeutral), 0);
});

test('applyBoostDelta applies additive boosts and clamps range', () => {
	const mon = makePokemon('Gyarados', { boosts: { atk: 5, def: -5, spa: 0, spd: 0, spe: 0 } });
	const boosted = applyBoostDelta(mon, { atk: 3, def: -3, spe: 2 });
	assert.deepEqual(boosted.boosts, { atk: 6, def: -6, spa: 0, spd: 0, spe: 2 });
});

test('setupBoostDelta prefers explicit move boosts and recognizes known setup names', () => {
	assert.deepEqual(setupBoostDelta(makeMove({ name: 'Custom Setup', category: 'Status', setupBoosts: { atk: 2 } })), { atk: 2 });
	assert.deepEqual(setupBoostDelta(makeMove({ name: 'Dragon Dance', category: 'Status' })), { atk: 1, spe: 1 });
	assert.equal(setupBoostDelta(makeMove({ name: 'Will-O-Wisp', category: 'Status' })), undefined);
});

test('aggregateOpponentResponse blends worst-case and weighted average safely', () => {
	assert.equal(aggregateOpponentResponse([], [], 0.5), 0);
	assert.equal(aggregateOpponentResponse([0.2, -0.5], [1, 1], 1), -0.5);
	assert.equal(aggregateOpponentResponse([0.2, -0.5], [10, 1], 0), (0.2 * 10 + -0.5) / 11);
	assert.equal(aggregateOpponentResponse([0.2, 0.1], [1], 3), 0.1);
});

test('pairCombinations covers normal and singleton team sizes', () => {
	const a = makePokemon('A');
	const b = makePokemon('B');
	const c = makePokemon('C');
	assert.deepEqual(pairCombinations([a, b, c]).map(pair => [pair[0].species.name, pair[1].species.name]), [
		['A', 'B'],
		['A', 'C'],
		['B', 'C'],
	]);
	assert.deepEqual(pairCombinations([a]).map(pair => [pair[0].species.name, pair[1].species.name]), [['A', 'A']]);
});

test('defensiveReliabilityScore returns bounded values with move resistance context', () => {
	const attacker = makePokemon('Attacker', { species: { name: 'Attacker', types: ['Water'], baseStats: { hp: 80, atk: 90, def: 80, spa: 90, spd: 80, spe: 80 } } });
	const defender = makePokemon('Defender', { species: { name: 'Defender', types: ['Fire'], baseStats: { hp: 80, atk: 90, def: 80, spa: 90, spd: 80, spe: 80 } } });
	const myProfile = { min: 80, max: 100, expected: 90, hitChance: 1, oneHkoChance: 0.4, twoHkoChance: 0.9, distribution: [{ damage: 90, prob: 1 }] };
	const enemyProfile = { min: 20, max: 40, expected: 30, hitChance: 1, oneHkoChance: 0, twoHkoChance: 0.2, distribution: [{ damage: 30, prob: 1 }] };
	const score = defensiveReliabilityScore(attacker, defender, myProfile, enemyProfile, makeMove({ name: 'Flamethrower', type: 'Fire', category: 'Special' }));
	assert.ok(score >= -1 && score <= 1);
	assert.ok(score > 0);
	assert.equal(defensiveReliabilityScore(attacker, defender, undefined, enemyProfile, makeMove()), 0);
});
