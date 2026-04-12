import type { BattlePokemon, BattleState, EvaluationOptions, MoveEntry } from '../types.js';
import { computeDamageProfile, expectedDamage, pickBestMove } from './damage.js';
import {
	aggregateOpponentResponse,
	applyBoostDelta,
	defensiveReliabilityScore,
	effectiveSpeedWithSide,
	inferRole,
	isOffensiveSetupMove,
	modePreset,
	movePriority,
	residualFraction,
	roleMatchupBonus,
	setupBoostDelta,
} from './helpers.js';
import type { DamageProfile } from './types.js';

export function expectedTurnOrder(
	left: BattlePokemon,
	right: BattlePokemon,
	leftMove?: MoveEntry,
	rightMove?: MoveEntry,
	battleState?: BattleState,
): 'left' | 'right' | 'speed-tie' {
	const lp = movePriority(leftMove);
	const rp = movePriority(rightMove);
	if (lp > rp) return 'left';
	if (rp > lp) return 'right';
	const ls = effectiveSpeedWithSide(left, battleState?.mySide, leftMove);
	const rs = effectiveSpeedWithSide(right, battleState?.enemySide, rightMove);
	if (ls > rs) return 'left';
	if (rs > ls) return 'right';
	return 'speed-tie';
}

function simulateExchangeScore(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	myMove: MoveEntry | undefined,
	oppMove: MoveEntry | undefined,
	battleState: BattleState | undefined,
	turns: 1 | 2 | 3,
): number {
	if (!myMove && !oppMove) return 0;
	let myHp = attacker.stats.hp;
	let oppHp = defender.stats.hp;
	let myToxicCounter = attacker.status === 'tox' ? 1 : 0;
	let oppToxicCounter = defender.status === 'tox' ? 1 : 0;
	let dealtNormTotal = 0;
	let takenNormTotal = 0;

	const resolveTurn = (
		myBefore: number,
		oppBefore: number,
		meFirst: boolean,
		meHit: number,
		oppHit: number,
	): { myAfter: number; oppAfter: number; dealtNorm: number; takenNorm: number } => {
		let myAfter = myBefore;
		let oppAfter = oppBefore;
		let dealtNorm = 0;
		let takenNorm = 0;
		if (meFirst) {
			const appliedMeHit = Math.min(Math.max(0, meHit), Math.max(0, oppBefore));
			if (oppBefore > 0) dealtNorm += appliedMeHit / Math.max(1, defender.stats.hp);
			oppAfter -= meHit;
			if (oppAfter > 0) {
				const appliedOppHit = Math.min(Math.max(0, oppHit), Math.max(0, myAfter));
				myAfter -= oppHit;
				takenNorm += appliedOppHit / Math.max(1, attacker.stats.hp);
			}
		} else {
			const appliedOppHit = Math.min(Math.max(0, oppHit), Math.max(0, myBefore));
			if (myBefore > 0) takenNorm += appliedOppHit / Math.max(1, attacker.stats.hp);
			myAfter -= oppHit;
			if (myAfter > 0) {
				const appliedMeHit = Math.min(Math.max(0, meHit), Math.max(0, oppAfter));
				dealtNorm += appliedMeHit / Math.max(1, defender.stats.hp);
				oppAfter -= meHit;
			}
		}
		if (myAfter > 0 && oppAfter > 0) {
			const myResidual = attacker.status === 'tox'
				? (attacker.stats.hp * myToxicCounter) / 16
				: attacker.stats.hp * residualFraction(attacker);
			const oppResidual = defender.status === 'tox'
				? (defender.stats.hp * oppToxicCounter) / 16
				: defender.stats.hp * residualFraction(defender);
			const appliedMyResidual = Math.min(Math.max(0, myResidual), Math.max(0, myAfter));
			const appliedOppResidual = Math.min(Math.max(0, oppResidual), Math.max(0, oppAfter));
			myAfter -= myResidual;
			oppAfter -= oppResidual;
			takenNorm += appliedMyResidual / Math.max(1, attacker.stats.hp);
			dealtNorm += appliedOppResidual / Math.max(1, defender.stats.hp);
			if (attacker.status === 'tox') myToxicCounter += 1;
			if (defender.status === 'tox') oppToxicCounter += 1;
		}
		myAfter = Math.min(attacker.stats.hp, Math.max(0, myAfter));
		oppAfter = Math.min(defender.stats.hp, Math.max(0, oppAfter));
		return { myAfter, oppAfter, dealtNorm, takenNorm };
	};

	for (let turn = 0; turn < turns; turn++) {
		const order = expectedTurnOrder(attacker, defender, myMove, oppMove, battleState);

		const meHit = myMove ? expectedDamage(attacker, defender, myMove, battleState, true) : 0;
		const oppHit = oppMove ? expectedDamage(defender, attacker, oppMove, battleState, false) : 0;

		if (order === 'speed-tie') {
			const meFirst = resolveTurn(myHp, oppHp, true, meHit, oppHit);
			const oppFirst = resolveTurn(myHp, oppHp, false, meHit, oppHit);
			myHp = (meFirst.myAfter + oppFirst.myAfter) / 2;
			oppHp = (meFirst.oppAfter + oppFirst.oppAfter) / 2;
			dealtNormTotal += (meFirst.dealtNorm + oppFirst.dealtNorm) / 2;
			takenNormTotal += (meFirst.takenNorm + oppFirst.takenNorm) / 2;
		} else {
			const resolved = resolveTurn(myHp, oppHp, order === 'left', meHit, oppHit);
			myHp = resolved.myAfter;
			oppHp = resolved.oppAfter;
			dealtNormTotal += resolved.dealtNorm;
			takenNormTotal += resolved.takenNorm;
		}

		if (myHp <= 0 || oppHp <= 0) break;
	}

	return dealtNormTotal - takenNormTotal;
}

function simulateSetupPlanScore(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	setupMove: MoveEntry,
	attackMove: MoveEntry | undefined,
	oppMove: MoveEntry | undefined,
	battleState: BattleState | undefined,
	turns: 1 | 2 | 3,
	setupTurns = 1,
): number {
	let myHp = attacker.stats.hp;
	let oppHp = defender.stats.hp;
	let myToxicCounter = attacker.status === 'tox' ? 1 : 0;
	let oppToxicCounter = defender.status === 'tox' ? 1 : 0;
	let dealtNormTotal = 0;
	let takenNormTotal = 0;
	if (turns <= 0) return 0;
	const plannedSetupTurns = Math.max(1, Math.min(setupTurns, turns));
	let boostedAttacker = attacker;

	const resolveSetupTurn = (
		myBefore: number,
		oppBefore: number,
		setupFirst: boolean,
		oppSetupHit: number,
	): { myAfter: number; oppAfter: number; fainted: boolean; dealtNorm: number; takenNorm: number } => {
		let myAfter = myBefore;
		let oppAfter = oppBefore;
		let dealtNorm = 0;
		let takenNorm = 0;
		if (!setupFirst) {
			const appliedOppSetupHit = Math.min(Math.max(0, oppSetupHit), Math.max(0, myBefore));
			takenNorm += appliedOppSetupHit / Math.max(1, attacker.stats.hp);
			myAfter -= oppSetupHit;
			if (myAfter <= 0) return { myAfter: 0, oppAfter, fainted: true, dealtNorm, takenNorm };
		}
		if (setupFirst) {
			const appliedOppSetupHit = Math.min(Math.max(0, oppSetupHit), Math.max(0, myBefore));
			takenNorm += appliedOppSetupHit / Math.max(1, attacker.stats.hp);
			myAfter -= oppSetupHit;
			if (myAfter <= 0) return { myAfter: 0, oppAfter, fainted: true, dealtNorm, takenNorm };
		}
		const myResidual = attacker.status === 'tox'
			? (attacker.stats.hp * myToxicCounter) / 16
			: attacker.stats.hp * residualFraction(attacker);
		const oppResidual = defender.status === 'tox'
			? (defender.stats.hp * oppToxicCounter) / 16
			: defender.stats.hp * residualFraction(defender);
		const appliedMyResidual = Math.min(Math.max(0, myResidual), Math.max(0, myAfter));
		const appliedOppResidual = Math.min(Math.max(0, oppResidual), Math.max(0, oppAfter));
		myAfter -= myResidual;
		oppAfter -= oppResidual;
		takenNorm += appliedMyResidual / Math.max(1, attacker.stats.hp);
		dealtNorm += appliedOppResidual / Math.max(1, defender.stats.hp);
		if (attacker.status === 'tox') myToxicCounter += 1;
		if (defender.status === 'tox') oppToxicCounter += 1;
		myAfter = Math.min(attacker.stats.hp, Math.max(0, myAfter));
		oppAfter = Math.min(defender.stats.hp, Math.max(0, oppAfter));
		return { myAfter, oppAfter, fainted: false, dealtNorm, takenNorm };
	};

	const resolveAttackTurn = (
		myBefore: number,
		oppBefore: number,
		meFirst: boolean,
		meHit: number,
		oppHit: number,
	): { myAfter: number; oppAfter: number; dealtNorm: number; takenNorm: number } => {
		let myAfter = myBefore;
		let oppAfter = oppBefore;
		let dealtNorm = 0;
		let takenNorm = 0;
		if (meFirst) {
			const appliedMeHit = Math.min(Math.max(0, meHit), Math.max(0, oppBefore));
			if (oppBefore > 0) dealtNorm += appliedMeHit / Math.max(1, defender.stats.hp);
			oppAfter -= meHit;
			if (oppAfter > 0) {
				const appliedOppHit = Math.min(Math.max(0, oppHit), Math.max(0, myAfter));
				myAfter -= oppHit;
				takenNorm += appliedOppHit / Math.max(1, attacker.stats.hp);
			}
		} else {
			const appliedOppHit = Math.min(Math.max(0, oppHit), Math.max(0, myBefore));
			if (myBefore > 0) takenNorm += appliedOppHit / Math.max(1, attacker.stats.hp);
			myAfter -= oppHit;
			if (myAfter > 0) {
				const appliedMeHit = Math.min(Math.max(0, meHit), Math.max(0, oppAfter));
				dealtNorm += appliedMeHit / Math.max(1, defender.stats.hp);
				oppAfter -= meHit;
			}
		}
		if (myAfter > 0 && oppAfter > 0) {
			const myResidual = attacker.status === 'tox'
				? (attacker.stats.hp * myToxicCounter) / 16
				: attacker.stats.hp * residualFraction(attacker);
			const oppResidual = defender.status === 'tox'
				? (defender.stats.hp * oppToxicCounter) / 16
				: defender.stats.hp * residualFraction(defender);
			const appliedMyResidual = Math.min(Math.max(0, myResidual), Math.max(0, myAfter));
			const appliedOppResidual = Math.min(Math.max(0, oppResidual), Math.max(0, oppAfter));
			myAfter -= myResidual;
			oppAfter -= oppResidual;
			takenNorm += appliedMyResidual / Math.max(1, attacker.stats.hp);
			dealtNorm += appliedOppResidual / Math.max(1, defender.stats.hp);
			if (attacker.status === 'tox') myToxicCounter += 1;
			if (defender.status === 'tox') oppToxicCounter += 1;
		}
		myAfter = Math.min(attacker.stats.hp, Math.max(0, myAfter));
		oppAfter = Math.min(defender.stats.hp, Math.max(0, oppAfter));
		return { myAfter, oppAfter, dealtNorm, takenNorm };
	};

	for (let turn = 0; turn < plannedSetupTurns; turn++) {
		const setupOrder = expectedTurnOrder(boostedAttacker, defender, setupMove, oppMove, battleState);
		const oppSetupHit = oppMove ? expectedDamage(defender, boostedAttacker, oppMove, battleState, false) : 0;
		const delta = setupBoostDelta(setupMove) ?? {};
		if (setupOrder === 'speed-tie') {
			const meFirst = resolveSetupTurn(myHp, oppHp, true, oppSetupHit);
			const oppFirst = resolveSetupTurn(myHp, oppHp, false, oppSetupHit);
			if (meFirst.fainted && oppFirst.fainted) return -1;
			myHp = ((meFirst.fainted ? 0 : meFirst.myAfter) + (oppFirst.fainted ? 0 : oppFirst.myAfter)) / 2;
			oppHp = (meFirst.oppAfter + oppFirst.oppAfter) / 2;
			dealtNormTotal += (meFirst.dealtNorm + oppFirst.dealtNorm) / 2;
			takenNormTotal += (meFirst.takenNorm + oppFirst.takenNorm) / 2;
		} else {
			const resolved = resolveSetupTurn(myHp, oppHp, setupOrder === 'left', oppSetupHit);
			if (resolved.fainted) return -1;
			myHp = resolved.myAfter;
			oppHp = resolved.oppAfter;
			dealtNormTotal += resolved.dealtNorm;
			takenNormTotal += resolved.takenNorm;
		}
		boostedAttacker = applyBoostDelta(boostedAttacker, delta);
	}

	for (let turn = plannedSetupTurns; turn < turns; turn++) {
		if (!attackMove) break;
		const order = expectedTurnOrder(boostedAttacker, defender, attackMove, oppMove, battleState);
		const meHit = expectedDamage(boostedAttacker, defender, attackMove, battleState, true);
		const oppHit = oppMove ? expectedDamage(defender, boostedAttacker, oppMove, battleState, false) : 0;
		if (order === 'speed-tie') {
			const meFirst = resolveAttackTurn(myHp, oppHp, true, meHit, oppHit);
			const oppFirst = resolveAttackTurn(myHp, oppHp, false, meHit, oppHit);
			myHp = (meFirst.myAfter + oppFirst.myAfter) / 2;
			oppHp = (meFirst.oppAfter + oppFirst.oppAfter) / 2;
			dealtNormTotal += (meFirst.dealtNorm + oppFirst.dealtNorm) / 2;
			takenNormTotal += (meFirst.takenNorm + oppFirst.takenNorm) / 2;
		} else {
			const resolved = resolveAttackTurn(myHp, oppHp, order === 'left', meHit, oppHit);
			myHp = resolved.myAfter;
			oppHp = resolved.oppAfter;
			dealtNormTotal += resolved.dealtNorm;
			takenNormTotal += resolved.takenNorm;
		}

		if (myHp <= 0 || oppHp <= 0) break;
	}

	return dealtNormTotal - takenNormTotal;
}

export function evaluate1v1(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	options: EvaluationOptions = {},
): { bestMove?: MoveEntry; score: number; profile?: DamageProfile; speedAdvantage: boolean; role: string; notes: string[] } {
	const preset = modePreset(options);
	const lookahead = preset.lookaheadTurns;
	const battleState = options.battleState;
	const notes: string[] = [];

	const myMoves = attacker.moves.length ? attacker.moves : [undefined as unknown as MoveEntry];
	const oppMoves = defender.moves.length ? defender.moves : [undefined as unknown as MoveEntry];
	const opponentRiskWeight = preset.opponentRiskWeight;

	let chosenMove: MoveEntry | undefined;
	let chosenProfile: DamageProfile | undefined;
	let bestWorstCase = -Infinity;

	for (const myMove of myMoves) {
		const responseScores: number[] = [];
		const responseWeights: number[] = [];
		for (const oppMove of oppMoves) {
			const score = simulateExchangeScore(attacker, defender, myMove, oppMove, battleState, lookahead);
			responseScores.push(score);
			if (!oppMove) {
				responseWeights.push(1);
				continue;
			}
			const oppProfile = computeDamageProfile(defender, attacker, oppMove, battleState, false);
			const oppDamageFrac = oppProfile.expected / Math.max(1, attacker.stats.hp);
			const oppKoThreat = (oppProfile.oneHkoChance * 1.2) + (oppProfile.twoHkoChance * 0.6);
			responseWeights.push(0.25 + oppDamageFrac + oppKoThreat);
		}
		const worstCaseForMe = aggregateOpponentResponse(responseScores, responseWeights, opponentRiskWeight);
		if (worstCaseForMe > bestWorstCase) {
			bestWorstCase = worstCaseForMe;
			chosenMove = myMove;
			chosenProfile = myMove ? computeDamageProfile(attacker, defender, myMove, battleState, true) : undefined;
		}
	}

	for (const setupMove of attacker.moves.filter(isOffensiveSetupMove)) {
		const maxSetupTurns = Math.min(2, lookahead);
		for (let setupTurns = 1; setupTurns <= maxSetupTurns; setupTurns++) {
			let boostedAttacker = attacker;
			for (let i = 0; i < setupTurns; i++) {
				boostedAttacker = applyBoostDelta(boostedAttacker, setupBoostDelta(setupMove) ?? {});
			}
			const followUp = pickBestMove(boostedAttacker, defender, battleState, true).move;
			const responseScores: number[] = [];
			const responseWeights: number[] = [];
			for (const oppMove of oppMoves) {
				const setupScore = simulateSetupPlanScore(attacker, defender, setupMove, followUp, oppMove, battleState, lookahead, setupTurns);
				responseScores.push(setupScore);
				if (!oppMove) {
					responseWeights.push(1);
					continue;
				}
				const oppProfile = computeDamageProfile(defender, attacker, oppMove, battleState, false);
				const oppDamageFrac = oppProfile.expected / Math.max(1, attacker.stats.hp);
				const oppKoThreat = (oppProfile.oneHkoChance * 1.2) + (oppProfile.twoHkoChance * 0.6);
				responseWeights.push(0.25 + oppDamageFrac + oppKoThreat);
			}
			const worstCaseForMe = aggregateOpponentResponse(responseScores, responseWeights, opponentRiskWeight);
			if (worstCaseForMe > bestWorstCase) {
				bestWorstCase = worstCaseForMe;
				chosenMove = followUp;
				chosenProfile = followUp ? computeDamageProfile(boostedAttacker, defender, followUp, battleState, true) : undefined;
				notes.push(`Setup discovered: ${setupMove.name}${setupTurns > 1 ? ` ×${setupTurns}` : ''}${followUp ? ` → ${followUp.name}` : ''}.`);
			}
		}
	}

	const fallback = pickBestMove(attacker, defender, battleState, true);
	if (!chosenMove && fallback.move) {
		chosenMove = fallback.move;
		chosenProfile = fallback.profile;
	}

	const enemyBest = pickBestMove(defender, attacker, battleState, false);
	const speedOrder = expectedTurnOrder(attacker, defender, chosenMove, enemyBest.move, battleState);
	const speedAdvantage = speedOrder === 'left' || speedOrder === 'speed-tie';

	if (!chosenMove) notes.push('No damaging move resolved; score driven by survival only.');
	if (speedOrder === 'speed-tie') notes.push('Speed tie detected; first action split approximately 50/50.');

	const likelyOppThreats = defender.moves
		.map((move) => ({ move, profile: computeDamageProfile(defender, attacker, move, battleState, false) }))
		.sort((a, b) => b.profile.expected - a.profile.expected)
		.slice(0, 2)
		.map((x) => `${x.move.name} (${((x.profile.expected / Math.max(1, attacker.stats.hp)) * 100).toFixed(0)}% exp)`);
	if (likelyOppThreats.length > 0) {
		notes.push(`Likely opponent retaliation branches: ${likelyOppThreats.join(' | ')}.`);
	}
	notes.push('Uses known or provided set info only; hidden tech may change ordering.');

	const role = inferRole(attacker);
	const enemyRole = inferRole(defender);
	const roleWeight = options.roleWeight ?? 0.12;
	const defensiveWeight = preset.defensiveWeight;
	const defensiveScore = defensiveReliabilityScore(attacker, defender, chosenProfile, enemyBest.profile, enemyBest.move);
	const score = bestWorstCase
		+ roleMatchupBonus(role, enemyRole) * roleWeight
		+ defensiveScore * defensiveWeight;

	if (defensiveScore >= 0.25) notes.push('Defensive stability favorable versus likely retaliation profile.');
	if (defensiveScore <= -0.25) notes.push('Defensive risk elevated against likely retaliation profile.');

	return { bestMove: chosenMove, score, profile: chosenProfile, speedAdvantage, role, notes };
}
