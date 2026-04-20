import { evaluate2v2 } from './doubles.js';
import { hazardSwitchInFraction } from './helpers.js';
import { evaluate1v1 } from './singles.js';
import type { BattlePokemon, EvaluationOptions } from '../types.js';
import type { PokemonPairVariant, PokemonVariant } from './variants.js';

type SinglesWorstResponse = {
	duel: ReturnType<typeof evaluate1v1>;
	score: number;
	notes: string[];
	enemy: BattlePokemon;
	enemyTag: string;
};

type DoublesWorstResponse = {
	duel: ReturnType<typeof evaluate2v2>;
	score: number;
	notes: string[];
	enemyTag: string;
};

function pickBestVariant<TVariant, TWorst, TBest>(
	variants: TVariant[],
	selectWorst: (variant: TVariant) => TWorst | null,
	getWorstScore: (worst: TWorst) => number,
	toBest: (variant: TVariant, worst: TWorst) => TBest,
	getBestScore: (best: TBest) => number,
): TBest | null {
	let bestChoice: TBest | null = null;
	for (const variant of variants) {
		const worst = selectWorst(variant);
		if (!worst) continue;
		if (!bestChoice || getWorstScore(worst) > getBestScore(bestChoice)) {
			bestChoice = toBest(variant, worst);
		}
	}
	return bestChoice;
}

export type BestSinglesChoice = {
	duel: ReturnType<typeof evaluate1v1>;
	score: number;
	notes: string[];
	mine: BattlePokemon;
	enemy: BattlePokemon;
	myTag: string;
	enemyTag: string;
};

export type BestDoublesChoice = {
	duel: ReturnType<typeof evaluate2v2>;
	score: number;
	notes: string[];
	myTag: string;
	enemyTag: string;
};

function applySinglesHazardPenalty(
	score: number,
	notes: string[],
	myPokemon: BattlePokemon,
	options: EvaluationOptions,
): { score: number; notes: string[] } {
	if (!options.allowSwitching) return { score, notes };
	const hazardPenalty = hazardSwitchInFraction(myPokemon, options.battleState?.mySide);
	if (hazardPenalty <= 0) return { score, notes };
	return {
		score: score - hazardPenalty,
		notes: [...notes, `Switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% HP loss.`],
	};
}

function applyDoublesHazardPenalty(
	score: number,
	notes: string[],
	myPair: [BattlePokemon, BattlePokemon],
	options: EvaluationOptions,
): { score: number; notes: string[] } {
	if (!options.allowSwitching) return { score, notes };
	const hazardPenalty = hazardSwitchInFraction(myPair[0], options.battleState?.mySide)
		+ hazardSwitchInFraction(myPair[1], options.battleState?.mySide);
	if (hazardPenalty <= 0) return { score, notes };
	return {
		score: score - hazardPenalty,
		notes: [...notes, `Lead switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% combined HP loss.`],
	};
}

function selectWorstSinglesResponse(
	myVariant: PokemonVariant,
	enemyVariants: PokemonVariant[],
	options: EvaluationOptions,
): SinglesWorstResponse | null {
	let worst: SinglesWorstResponse | null = null;
	for (const enemyVariant of enemyVariants) {
		const duel = evaluate1v1(myVariant.pokemon, enemyVariant.pokemon, options);
		const adjusted = applySinglesHazardPenalty(duel.score, [...duel.notes], myVariant.pokemon, options);
		if (!worst || adjusted.score < worst.score) {
			worst = {
				duel,
				score: adjusted.score,
				notes: adjusted.notes,
				enemy: enemyVariant.pokemon,
				enemyTag: enemyVariant.tag,
			};
		}
	}
	return worst;
}

function selectWorstDoublesResponse(
	myVariant: PokemonPairVariant,
	enemyVariants: PokemonPairVariant[],
	options: EvaluationOptions,
): DoublesWorstResponse | null {
	let worst: DoublesWorstResponse | null = null;
	for (const enemyVariant of enemyVariants) {
		const duel = evaluate2v2(myVariant.pair, enemyVariant.pair, options);
		const adjusted = applyDoublesHazardPenalty(duel.score, [...duel.notes], myVariant.pair, options);
		if (!worst || adjusted.score < worst.score) {
			worst = {
				duel,
				score: adjusted.score,
				notes: adjusted.notes,
				enemyTag: enemyVariant.tag,
			};
		}
	}
	return worst;
}

export function selectBestSinglesChoice(
	myVariants: PokemonVariant[],
	enemyVariants: PokemonVariant[],
	options: EvaluationOptions,
): BestSinglesChoice | null {
	return pickBestVariant(
		myVariants,
		myVariant => selectWorstSinglesResponse(myVariant, enemyVariants, options),
		worst => worst.score,
		(myVariant, worst) => ({
			duel: worst.duel,
			score: worst.score,
			notes: worst.notes,
			mine: myVariant.pokemon,
			enemy: worst.enemy,
			myTag: myVariant.tag,
			enemyTag: worst.enemyTag,
		}),
		best => best.score,
	);
}

export function selectBestDoublesChoice(
	myPairVariants: PokemonPairVariant[],
	enemyPairVariants: PokemonPairVariant[],
	options: EvaluationOptions,
): BestDoublesChoice | null {
	return pickBestVariant(
		myPairVariants,
		myVariant => selectWorstDoublesResponse(myVariant, enemyPairVariants, options),
		worst => worst.score,
		(myVariant, worst) => ({
			duel: worst.duel,
			score: worst.score,
			notes: worst.notes,
			myTag: myVariant.tag,
			enemyTag: worst.enemyTag,
		}),
		best => best.score,
	);
}
