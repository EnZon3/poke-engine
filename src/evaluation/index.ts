import { DATA_CACHE } from '../data.js';
import { buildPokemon } from '../pokemon.js';
import { evaluate2v2 } from './doubles.js';
import { buildRationale, confidenceFromSignals, hazardSwitchInFraction, pairCombinations } from './helpers.js';
import { evaluate1v1 } from './singles.js';
import type { EvaluationOptions, MatchupEvaluation, PokemonSet } from '../types.js';

export { hazardSwitchInFraction } from './helpers.js';

export function evaluateTeams(
	myTeam: PokemonSet[],
	enemyTeam: PokemonSet[],
	options: EvaluationOptions = {},
): Record<string, MatchupEvaluation[]> {
	if (!DATA_CACHE.species || !DATA_CACHE.moves) {
		throw new Error('Data not loaded; call loadData() first');
	}
	const myBattleTeam = myTeam.map(buildPokemon);
	const enemyBattleTeam = enemyTeam.map(buildPokemon);
	const results: Record<string, MatchupEvaluation[]> = {};
	const battleFormat = options.battleFormat ?? 'singles';

	if (battleFormat === 'doubles') {
		const myLeads = pairCombinations(myBattleTeam);
		const enemyLeads = pairCombinations(enemyBattleTeam);
		for (const enemyLead of enemyLeads) {
			const enemyKey = `${enemyLead[0].species.name} + ${enemyLead[1].species.name}`;
			const evaluations: MatchupEvaluation[] = [];
			for (const myLead of myLeads) {
				const duel = evaluate2v2(myLead, enemyLead, options);
				let score = duel.score;
				const notes = [...duel.notes];
				if (options.allowSwitching) {
					const hazardPenalty = hazardSwitchInFraction(myLead[0], options.battleState?.mySide)
						+ hazardSwitchInFraction(myLead[1], options.battleState?.mySide);
					if (hazardPenalty > 0) {
						score -= hazardPenalty;
						notes.push(`Lead switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% combined HP loss.`);
					}
				}
				const confidence = confidenceFromSignals(score, duel.profile, notes);
				evaluations.push({
					pokemon: duel.pairName,
					move: duel.moveSummary,
					score,
					minDamagePercent: duel.profile ? duel.profile.min : undefined,
					maxDamagePercent: duel.profile ? duel.profile.max : undefined,
					oneHkoChance: duel.profile?.oneHkoChance,
					twoHkoChance: duel.profile?.twoHkoChance,
					speedAdvantage: duel.speedAdvantage,
					role: duel.role,
					confidence,
					rationale: buildRationale({
						profile: duel.profile,
						score,
						speedAdvantage: duel.speedAdvantage,
						role: duel.role,
						confidence,
					}),
					notes,
				});
			}
			evaluations.sort((a, b) => b.score - a.score);
			results[enemyKey] = evaluations;
		}
		return results;
	}

	for (const enemy of enemyBattleTeam) {
		const evaluations: MatchupEvaluation[] = [];
		for (const mine of myBattleTeam) {
			const duel = evaluate1v1(mine, enemy, options);
			let score = duel.score;
			const notes = [...duel.notes];
			if (options.allowSwitching) {
				const hazardPenalty = hazardSwitchInFraction(mine, options.battleState?.mySide);
				if (hazardPenalty > 0) {
					score -= hazardPenalty;
					notes.push(`Switch-in hazards estimate: ${(hazardPenalty * 100).toFixed(1)}% HP loss.`);
				}
			}
			const confidence = confidenceFromSignals(score, duel.profile, notes);

			evaluations.push({
				pokemon: mine.species.name,
				move: duel.bestMove?.name,
				score,
				minDamagePercent: duel.profile ? (duel.profile.min / enemy.stats.hp) * 100 : undefined,
				maxDamagePercent: duel.profile ? (duel.profile.max / enemy.stats.hp) * 100 : undefined,
				oneHkoChance: duel.profile?.oneHkoChance,
				twoHkoChance: duel.profile?.twoHkoChance,
				speedAdvantage: duel.speedAdvantage,
				role: duel.role,
				confidence,
				rationale: buildRationale({
					profile: duel.profile,
					score,
					speedAdvantage: duel.speedAdvantage,
					role: duel.role,
					confidence,
				}),
				notes,
			});
		}
		evaluations.sort((a, b) => b.score - a.score);
		results[enemy.species.name] = evaluations;
	}
	return results;
}
