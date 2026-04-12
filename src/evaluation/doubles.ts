import type { BattlePokemon, BattleState, EvaluationOptions, MoveEntry } from '../types.js';
import { computeDamageProfile, pickBestMove } from './damage.js';
import {
	clamp,
	effectiveSpeed,
	hasMoveId,
	hasOffensiveMoveType,
	hasType,
	inferRole,
	moveId,
	pairCombinations,
	roleMatchupBonus,
} from './helpers.js';
import type { DamageProfile, DoublesAction } from './types.js';

const SPREAD_MOVE_IDS = new Set<string>([
	'rockslide', 'heatwave', 'dazzlinggleam', 'muddywater', 'surf', 'earthquake', 'discharge', 'blizzard',
	'snarl', 'icywind', 'electroweb', 'breakingswipe', 'makeitrain', 'eruption', 'waterspout', 'boomburst',
]);

const PROTECT_IDS = new Set<string>(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap']);

function isSpreadMove(move: MoveEntry): boolean {
	return SPREAD_MOVE_IDS.has(move.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function supportMoveHeuristic(
	attacker: BattlePokemon,
	move: MoveEntry,
	ally: BattlePokemon,
	enemy1: BattlePokemon,
	enemy2: BattlePokemon,
	battleState: BattleState | undefined,
	attackerOnMySide: boolean,
): { value: number; notes: string[] } {
	const id = moveId(move.name);
	const notes: string[] = [];
	let value = 0;

	if (PROTECT_IDS.has(id)) {
		value += 0.18;
		notes.push('Protect-style safety turn.');
	}
	if (id === 'fakeout') {
		const allyBest = Math.max(
			pickBestMove(ally, enemy1, battleState, attackerOnMySide).fraction,
			pickBestMove(ally, enemy2, battleState, attackerOnMySide).fraction,
		);
		value += 0.24 + (allyBest * 0.45);
		notes.push('Fake Out tempo pressure.');
	}
	if (id === 'tailwind') {
		const myAvg = (effectiveSpeed(attacker) + effectiveSpeed(ally)) / 2;
		const enemyAvg = (effectiveSpeed(enemy1) + effectiveSpeed(enemy2)) / 2;
		value += myAvg < enemyAvg ? 0.28 : 0.16;
		notes.push('Team speed control (Tailwind).');
	}
	if (id === 'trickroom') {
		const myAvg = (effectiveSpeed(attacker) + effectiveSpeed(ally)) / 2;
		const enemyAvg = (effectiveSpeed(enemy1) + effectiveSpeed(enemy2)) / 2;
		value += myAvg > enemyAvg ? 0.28 : 0.12;
		notes.push('Reverse speed control (Trick Room).');
	}
	if (id === 'icywind' || id === 'electroweb') {
		value += 0.2;
		notes.push('Multi-target speed drop utility.');
	}
	if (id === 'thunderwave' || id === 'nuzzle') {
		value += 0.17;
		notes.push('Targeted speed control/paralysis utility.');
	}
	if (id === 'helpinghand') {
		const allyBest = Math.max(
			pickBestMove(ally, enemy1, battleState, attackerOnMySide).fraction,
			pickBestMove(ally, enemy2, battleState, attackerOnMySide).fraction,
		);
		value += 0.08 + (allyBest * 0.35);
		notes.push('Helping Hand partner damage amplification.');
	}
	if (id === 'followme' || id === 'ragepowder') {
		const enemyBurst = Math.max(
			pickBestMove(enemy1, attacker, battleState, !attackerOnMySide).fraction,
			pickBestMove(enemy2, attacker, battleState, !attackerOnMySide).fraction,
		);
		value += 0.16 + (enemyBurst * 0.25);
		notes.push('Redirection support value.');
	}
	if (id === 'wideguard' || id === 'quickguard') {
		value += 0.14;
		notes.push('Guard utility versus priority/spread threats.');
	}

	return { value: clamp(value, 0, 0.6), notes };
}

function chooseBestDoublesAction(
	attacker: BattlePokemon,
	ally: BattlePokemon,
	enemy1: BattlePokemon,
	enemy2: BattlePokemon,
	battleState: BattleState | undefined,
	attackerOnMySide: boolean,
): DoublesAction {
	const totalEnemyHp = Math.max(1, enemy1.stats.hp + enemy2.stats.hp);
	let best: DoublesAction = {
		move: undefined,
		target: 'support',
		expectedDamage: 0,
		expectedFraction: 0,
		supportValue: 0,
		notes: ['No move available.'],
	};

	for (const move of attacker.moves) {
		const notes: string[] = [];
		if (move.category === 'Status') {
			const support = supportMoveHeuristic(attacker, move, ally, enemy1, enemy2, battleState, attackerOnMySide);
			const action: DoublesAction = {
				move,
				target: 'support',
				expectedDamage: 0,
				expectedFraction: 0,
				supportValue: support.value,
				notes: support.notes,
			};
			if ((action.supportValue + action.expectedFraction) > (best.supportValue + best.expectedFraction)) {
				best = action;
			}
			continue;
		}

		const p1 = computeDamageProfile(attacker, enemy1, move, battleState, attackerOnMySide);
		const p2 = computeDamageProfile(attacker, enemy2, move, battleState, attackerOnMySide);
		if (isSpreadMove(move)) {
			const spreadDamage = (p1.expected * 0.75) + (p2.expected * 0.75);
			const action: DoublesAction = {
				move,
				target: 'both',
				expectedDamage: spreadDamage,
				expectedFraction: spreadDamage / totalEnemyHp,
				supportValue: 0,
				primaryProfile: p1,
				secondaryProfile: p2,
				notes: ['Spread move pressure across both targets.'],
			};
			if ((action.supportValue + action.expectedFraction) > (best.supportValue + best.expectedFraction)) {
				best = action;
			}
			continue;
		}

		const hitSlot1 = p1.expected >= p2.expected;
		const targetProfile = hitSlot1 ? p1 : p2;
		notes.push(`Focus fire on ${hitSlot1 ? enemy1.species.name : enemy2.species.name}.`);
		const action: DoublesAction = {
			move,
			target: hitSlot1 ? 'slot1' : 'slot2',
			expectedDamage: targetProfile.expected,
			expectedFraction: targetProfile.expected / totalEnemyHp,
			supportValue: 0,
			primaryProfile: targetProfile,
			notes,
		};
		if ((action.supportValue + action.expectedFraction) > (best.supportValue + best.expectedFraction)) {
			best = action;
		}
	}

	return best;
}

export function evaluate2v2(
	myLead: [BattlePokemon, BattlePokemon],
	enemyLead: [BattlePokemon, BattlePokemon],
	options: EvaluationOptions,
): {
	pairName: string;
	moveSummary: string;
	score: number;
	profile?: DamageProfile;
	speedAdvantage: boolean;
	role: string;
	notes: string[];
} {
	const battleState = options.battleState;
	const [my1, my2] = myLead;
	const [en1, en2] = enemyLead;

	const myAction1 = chooseBestDoublesAction(my1, my2, en1, en2, battleState, true);
	const myAction2 = chooseBestDoublesAction(my2, my1, en1, en2, battleState, true);
	const enemyAction1 = chooseBestDoublesAction(en1, en2, my1, my2, battleState, false);
	const enemyAction2 = chooseBestDoublesAction(en2, en1, my1, my2, battleState, false);

	const myPressure = (myAction1.expectedFraction + myAction1.supportValue) + (myAction2.expectedFraction + myAction2.supportValue);
	const enemyPressure = (enemyAction1.expectedFraction + enemyAction1.supportValue) + (enemyAction2.expectedFraction + enemyAction2.supportValue);

	let synergy = 0;
	const myIds = [moveId(myAction1.move?.name), moveId(myAction2.move?.name)];
	if (myIds.includes('fakeout')) synergy += 0.08;
	if (myIds.includes('helpinghand') && (myAction1.expectedFraction > 0 || myAction2.expectedFraction > 0)) synergy += 0.06;
	if (myIds.includes('tailwind') || myIds.includes('trickroom')) synergy += 0.06;
	if (myAction1.target === 'both' && myAction2.target === 'both') synergy += 0.04;
	const myHasFakeOut = hasMoveId(my1, 'fakeout') || hasMoveId(my2, 'fakeout');
	const myHasRedirection = hasMoveId(my1, 'ragepowder') || hasMoveId(my1, 'followme') || hasMoveId(my2, 'ragepowder') || hasMoveId(my2, 'followme');
	if (myHasFakeOut && myHasRedirection) {
		synergy += 0.18;
	}
	if (myHasFakeOut) {
		const partnerDamage = Math.max(myAction1.expectedFraction, myAction2.expectedFraction);
		synergy += Math.min(0.12, partnerDamage * 0.35);
	}

	const myGhostCount = [my1, my2].filter((p) => hasType(p, 'Ghost')).length;

	const enemyIds = [moveId(enemyAction1.move?.name), moveId(enemyAction2.move?.name)];
	if (enemyIds.includes('fakeout')) synergy -= 0.08;
	const enemyHasFakeOut = hasMoveId(en1, 'fakeout') || hasMoveId(en2, 'fakeout');
	if (enemyHasFakeOut && myGhostCount > 0) {
		synergy += myGhostCount * 0.1;
	}

	const myCoverage = [
		Math.max(pickBestMove(my1, en1, battleState, true).fraction, pickBestMove(my2, en1, battleState, true).fraction),
		Math.max(pickBestMove(my1, en2, battleState, true).fraction, pickBestMove(my2, en2, battleState, true).fraction),
	];
	const enemyCoverage = [
		Math.max(pickBestMove(en1, my1, battleState, false).fraction, pickBestMove(en2, my1, battleState, false).fraction),
		Math.max(pickBestMove(en1, my2, battleState, false).fraction, pickBestMove(en2, my2, battleState, false).fraction),
	];
	const myCoverageAvg = (myCoverage[0] + myCoverage[1]) / 2;
	const enemyCoverageAvg = (enemyCoverage[0] + enemyCoverage[1]) / 2;
	const coverageEdge = myCoverageAvg - enemyCoverageAvg;
	if (coverageEdge > 0) synergy += Math.min(0.14, coverageEdge * 0.35);
	else synergy += Math.max(-0.14, coverageEdge * 0.25);

	const enemyHasGrassType = hasType(en1, 'Grass') || hasType(en2, 'Grass');
	if (myHasRedirection && enemyHasGrassType) {
		synergy -= 0.14;
	}

	const enemyHasFireType = hasType(en1, 'Fire') || hasType(en2, 'Fire');
	const enemyHasGroundType = hasType(en1, 'Ground') || hasType(en2, 'Ground');
	const myHasWaterCoverage = hasOffensiveMoveType(my1, 'Water') || hasOffensiveMoveType(my2, 'Water');
	const myHasGrassCoverage = hasOffensiveMoveType(my1, 'Grass') || hasOffensiveMoveType(my2, 'Grass');
	if (enemyHasFireType && enemyHasGroundType && myHasWaterCoverage && myHasGrassCoverage) {
		synergy += 0.2;
	}

	const myHasGroundCoverage = hasOffensiveMoveType(my1, 'Ground') || hasOffensiveMoveType(my2, 'Ground');
	if (enemyHasFakeOut && myGhostCount > 0 && myHasGroundCoverage) {
		synergy += 0.32;
	}
	if (enemyHasFakeOut && enemyHasGrassType && myGhostCount > 0 && myHasGroundCoverage) {
		synergy += 0.28;
	}

	const enemyAtkBias = [en1, en2].filter((p) => p.stats.atk >= p.stats.spa).length;
	const myIntimidateCount = [my1, my2].filter((p) => p.ability?.toLowerCase() === 'intimidate').length;
	if (enemyAtkBias > 0 && myIntimidateCount > 0) {
		synergy += Math.min(0.14, 0.07 * myIntimidateCount * enemyAtkBias);
	}
	if (myHasFakeOut && myHasRedirection && myIntimidateCount > 0) {
		synergy += 0.12;
	}
	const enemyHasWaterOffense = hasOffensiveMoveType(en1, 'Water') || hasOffensiveMoveType(en2, 'Water');
	if (myHasRedirection && myIntimidateCount > 0 && enemyHasWaterOffense) {
		synergy += 0.18;
	}
	const enemyHasUrshifuRapidStrike = [en1.species.name, en2.species.name].some((n) => n.toLowerCase().includes('urshifu-rapid-strike'));
	const enemyHasFastSpecialPressure = [en1, en2].some((p) => p.stats.spa >= p.stats.atk && effectiveSpeed(p) >= 170);
	if (enemyHasUrshifuRapidStrike && myHasRedirection && myIntimidateCount > 0) {
		synergy += 0.16;
	}
	if (enemyHasUrshifuRapidStrike && enemyHasFastSpecialPressure && myHasRedirection && myIntimidateCount > 0) {
		synergy += 0.28;
	}

	const mySpecies = [my1.species.name, my2.species.name];
	const enemySpecies = new Set([en1.species.name, en2.species.name]);
	const overlapCount = mySpecies.filter((name) => enemySpecies.has(name)).length;
	if (overlapCount > 0) {
		synergy -= overlapCount * 0.24;
	}
	const myOverlapMons = [my1, my2].filter((p) => enemySpecies.has(p.species.name));
	const mirrorFakeOutCount = myOverlapMons.filter((p) => hasMoveId(p, 'fakeout')).length;
	if (mirrorFakeOutCount > 0 && enemyHasFakeOut) {
		synergy -= mirrorFakeOutCount * 0.22;
	}

	const myAvgSpeed = (effectiveSpeed(my1) + effectiveSpeed(my2)) / 2;
	const enemyAvgSpeed = (effectiveSpeed(en1) + effectiveSpeed(en2)) / 2;
	const speedAdvantage = myAvgSpeed >= enemyAvgSpeed;
	if (!speedAdvantage && (myHasFakeOut || myHasRedirection)) {
		synergy += 0.08;
	}

	const roleWeight = options.roleWeight ?? 0.12;
	const role1 = inferRole(my1);
	const role2 = inferRole(my2);
	const enemyRole1 = inferRole(en1);
	const enemyRole2 = inferRole(en2);
	const roleBoost = (
		roleMatchupBonus(role1, enemyRole1)
		+ roleMatchupBonus(role1, enemyRole2)
		+ roleMatchupBonus(role2, enemyRole1)
		+ roleMatchupBonus(role2, enemyRole2)
	) * (roleWeight / 2);

	const score = (myPressure - enemyPressure) + synergy + roleBoost;
	const totalEnemyHp = Math.max(1, en1.stats.hp + en2.stats.hp);
	const approxMin = ((myAction1.primaryProfile?.min ?? 0) + (myAction2.primaryProfile?.min ?? 0));
	const approxMax = ((myAction1.primaryProfile?.max ?? 0) + (myAction2.primaryProfile?.max ?? 0));
	const approxExpected = ((myAction1.primaryProfile?.expected ?? 0) + (myAction2.primaryProfile?.expected ?? 0));
	const syntheticProfile: DamageProfile = {
		min: approxMin,
		max: approxMax,
		expected: approxExpected,
		hitChance: 1,
		oneHkoChance: clamp(myPressure * 0.9, 0, 1),
		twoHkoChance: clamp(myPressure * 1.5, 0, 1),
		distribution: [{ damage: approxExpected, prob: 1 }],
	};

	const notes = [
		...myAction1.notes,
		...myAction2.notes,
		`Enemy pressure estimate ${(enemyPressure * 100).toFixed(1)}% of your lead HP pool.`,
		`Lead pressure estimate ${(myPressure * 100).toFixed(1)}% of opposing lead HP pool.`,
		'Doubles heuristic: includes spread-move pressure, support tempo, and lead synergy.',
		'Uses known/provided set info only; hidden lines and protects can alter practical outcomes.',
	];

	return {
		pairName: `${my1.species.name} + ${my2.species.name}`,
		moveSummary: `${myAction1.move?.name ?? 'Support'} / ${myAction2.move?.name ?? 'Support'}`,
		score,
		profile: {
			...syntheticProfile,
			min: Math.floor((approxMin / totalEnemyHp) * 100),
			max: Math.floor((approxMax / totalEnemyHp) * 100),
			expected: Math.floor((approxExpected / totalEnemyHp) * 100),
		},
		speedAdvantage,
		role: `${role1}/${role2}`,
		notes,
	};
}

export { pairCombinations };
