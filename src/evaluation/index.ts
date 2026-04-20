import { getDataCache } from '../data.js';
import { selectBestDoublesChoice, selectBestSinglesChoice } from './branching.js';
import type { BestDoublesChoice, BestSinglesChoice } from './branching.js';
import { buildRationale, confidenceFromSignals } from './helpers.js';
import { buildPairVariants, buildVariants, pairIndexCombinations } from './variants.js';
import type { EvaluationOptions, MatchupEvaluation, PokemonSet } from '../types.js';

export { hazardSwitchInFraction } from './helpers.js';

function withConfidenceAndRationale(
	score: number,
	profile: BestSinglesChoice['duel']['profile'],
	speedAdvantage: boolean,
	role: string,
	notes: string[],
): { confidence: MatchupEvaluation['confidence']; rationale: string[] } {
	const confidence = confidenceFromSignals(score, profile, notes);
	return {
		confidence,
		rationale: buildRationale({
			profile,
			score,
			speedAdvantage,
			role,
			confidence,
		}),
	};
}

function buildDoublesEntry(choice: BestDoublesChoice, options: EvaluationOptions): MatchupEvaluation {
	const notes = [...choice.notes];
	if (options.gimmickControl === 'auto' && choice.myTag) notes.push(`Auto gimmick timing selected: ${choice.myTag}.`);
	if (options.gimmickControl === 'auto' && choice.enemyTag) notes.push(`Opponent best response assumes: ${choice.enemyTag}.`);
	const { confidence, rationale } = withConfidenceAndRationale(
		choice.score,
		choice.duel.profile,
		choice.duel.speedAdvantage,
		choice.duel.role,
		notes,
	);
	return {
		pokemon: choice.duel.pairName,
		move: choice.duel.moveSummary,
		score: choice.score,
		minDamagePercent: choice.duel.profile ? choice.duel.profile.min : undefined,
		maxDamagePercent: choice.duel.profile ? choice.duel.profile.max : undefined,
		oneHkoChance: choice.duel.profile?.oneHkoChance,
		twoHkoChance: choice.duel.profile?.twoHkoChance,
		speedAdvantage: choice.duel.speedAdvantage,
		role: choice.duel.role,
		confidence,
		rationale,
		notes,
	};
}

function buildSinglesEntry(choice: BestSinglesChoice, options: EvaluationOptions): MatchupEvaluation {
	const notes = [...choice.notes];
	if (options.gimmickControl === 'auto' && choice.myTag !== 'base') notes.push(`Auto gimmick timing selected: ${choice.myTag}.`);
	if (options.gimmickControl === 'auto' && choice.enemyTag) notes.push(`Opponent best response assumes: ${choice.enemyTag}.`);
	const { confidence, rationale } = withConfidenceAndRationale(
		choice.score,
		choice.duel.profile,
		choice.duel.speedAdvantage,
		choice.duel.role,
		notes,
	);

	return {
		pokemon: choice.mine.species.name,
		move: choice.duel.bestMove?.name,
		score: choice.score,
		minDamagePercent: choice.duel.profile ? (choice.duel.profile.min / choice.enemy.stats.hp) * 100 : undefined,
		maxDamagePercent: choice.duel.profile ? (choice.duel.profile.max / choice.enemy.stats.hp) * 100 : undefined,
		oneHkoChance: choice.duel.profile?.oneHkoChance,
		twoHkoChance: choice.duel.profile?.twoHkoChance,
		speedAdvantage: choice.duel.speedAdvantage,
		role: choice.duel.role,
		confidence,
		rationale,
		notes,
	};
}

function evaluateDoublesAgainstPair(
	myTeam: PokemonSet[],
	myVariantsBySlot: ReturnType<typeof buildVariants>[],
	enemyVariantsBySlot: ReturnType<typeof buildVariants>[],
	options: EvaluationOptions,
	enemyA: number,
	enemyB: number,
): MatchupEvaluation[] {
	const myPairs = pairIndexCombinations(myTeam.length);
	const enemyPairVariants = buildPairVariants(enemyVariantsBySlot[enemyA], enemyVariantsBySlot[enemyB]);
	const evaluations: MatchupEvaluation[] = [];

	for (const [myA, myB] of myPairs) {
		const myPairVariants = buildPairVariants(myVariantsBySlot[myA], myVariantsBySlot[myB]);
		const choice = selectBestDoublesChoice(myPairVariants, enemyPairVariants, options);
		if (!choice) continue;
		evaluations.push(buildDoublesEntry(choice, options));
	}
	evaluations.sort((a, b) => b.score - a.score);
	return evaluations;
}

function evaluateSinglesAgainstEnemy(
	myTeam: PokemonSet[],
	myVariantsBySlot: ReturnType<typeof buildVariants>[],
	enemyVariants: ReturnType<typeof buildVariants>,
	options: EvaluationOptions,
): MatchupEvaluation[] {
	const evaluations: MatchupEvaluation[] = [];
	for (let myIndex = 0; myIndex < myTeam.length; myIndex++) {
		const myVariants = myVariantsBySlot[myIndex];
		const choice = selectBestSinglesChoice(myVariants, enemyVariants, options);
		if (!choice) continue;
		evaluations.push(buildSinglesEntry(choice, options));
	}
	evaluations.sort((a, b) => b.score - a.score);
	return evaluations;
}

export function evaluateTeams(
	myTeam: PokemonSet[],
	enemyTeam: PokemonSet[],
	options: EvaluationOptions = {},
): Record<string, MatchupEvaluation[]> {
	const cache = getDataCache();
	if (!cache.species || !cache.moves) {
		throw new Error('Data not loaded; call loadData() first');
	}
	const myVariantsBySlot = myTeam.map((set) => buildVariants(set, options));
	const enemyVariantsBySlot = enemyTeam.map((set) => buildVariants(set, options));
	const results: Record<string, MatchupEvaluation[]> = {};
	const battleFormat = options.battleFormat ?? 'singles';

	if (battleFormat === 'doubles') {
		const enemyPairs = pairIndexCombinations(enemyTeam.length);
		for (const [enemyA, enemyB] of enemyPairs) {
			const enemyKey = `${enemyTeam[enemyA]?.species ?? 'Unknown'} + ${enemyTeam[enemyB]?.species ?? 'Unknown'}`;
			results[enemyKey] = evaluateDoublesAgainstPair(
				myTeam,
				myVariantsBySlot,
				enemyVariantsBySlot,
				options,
				enemyA,
				enemyB,
			);
		}
		return results;
	}

	for (let enemyIndex = 0; enemyIndex < enemyTeam.length; enemyIndex++) {
		const enemyVariants = enemyVariantsBySlot[enemyIndex];
		const enemyKey = enemyTeam[enemyIndex]?.species ?? enemyVariants[0]?.pokemon.species.name ?? `Enemy ${enemyIndex + 1}`;
		results[enemyKey] = evaluateSinglesAgainstEnemy(myTeam, myVariantsBySlot, enemyVariants, options);
	}
	return results;
}
