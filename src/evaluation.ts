import { DATA_CACHE } from './data.js';
import { buildPokemon } from './pokemon.js';
import { evaluate2v2 } from './evaluation/doubles.js';
import { buildRationale, confidenceFromSignals, hazardSwitchInFraction, pairCombinations } from './evaluation/helpers.js';
import { evaluate1v1 } from './evaluation/singles.js';
import type { EvaluationOptions, MatchupEvaluation, PokemonSet } from './types.js';

export { hazardSwitchInFraction } from './evaluation/helpers.js';

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

/* Legacy monolith retained below for reference during refactor.

type ConfidenceLevel = 'Low' | 'Medium' | 'High';

interface DamageProfile {
	min: number;
	max: number;
	expected: number;
	hitChance: number;
	oneHkoChance: number;
	twoHkoChance: number;
	distribution: Array<{ damage: number; prob: number }>;
}

function stageMultiplier(stageRaw?: number): number {
	const stage = Math.max(-6, Math.min(6, stageRaw ?? 0));
	if (stage >= 0) return (2 + stage) / 2;
	return 2 / (2 - stage);
}

function getSideForDefender(attackerOnMySide: boolean, battleState?: BattleState): SideState | undefined {
	if (!battleState) return undefined;
	return attackerOnMySide ? battleState.enemySide : battleState.mySide;
}

function typeNormalized(t: string): string {
	if (!t) return t;
	return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function movePriority(move?: MoveEntry): number {
	return move?.priority ?? 0;
}

function residualFraction(pokemon: BattlePokemon): number {
	const item = pokemon.item?.toLowerCase();
	if (item === 'leftovers' || item === 'black sludge') return -1 / 16;
	if (pokemon.status === 'brn') return 1 / 16;
	if (pokemon.status === 'psn' || pokemon.status === 'tox') return 1 / 8;
	return 0;
}

function groundedForHazards(pokemon: BattlePokemon): boolean {
	const defTypes = pokemon.teraType ? [pokemon.teraType] : pokemon.species.types;
	return !defTypes.includes('Flying');
}

function statusActionChance(pokemon: BattlePokemon): number {
	let chance = 1;
	if (pokemon.status === 'par') chance *= 0.75;
	if (pokemon.status === 'slp') chance *= 0.33;
	if (pokemon.status === 'frz') chance *= 0.2;
	return chance;
}

function modePreset(options: EvaluationOptions): Required<Pick<EvaluationOptions, 'lookaheadTurns' | 'defensiveWeight' | 'opponentRiskWeight'>> {
	if (options.mode === 'competitive') {
		return {
			lookaheadTurns: options.lookaheadTurns ?? 3,
			defensiveWeight: options.defensiveWeight ?? 0.4,
			opponentRiskWeight: options.opponentRiskWeight ?? 0.65,
		};
	}
	if (options.mode === 'casual') {
		return {
			lookaheadTurns: options.lookaheadTurns ?? 2,
			defensiveWeight: options.defensiveWeight ?? 0.22,
			opponentRiskWeight: options.opponentRiskWeight ?? 0.5,
		};
	}
	return {
		lookaheadTurns: options.lookaheadTurns ?? 2,
		defensiveWeight: options.defensiveWeight ?? 0.3,
		opponentRiskWeight: options.opponentRiskWeight ?? 0.55,
	};
}

function buildRationale(entry: {
	profile?: DamageProfile;
	score: number;
	speedAdvantage: boolean;
	role: string;
	confidence: ConfidenceLevel;
}): string[] {
	const items: string[] = [];
	if (entry.speedAdvantage) items.push('Acts first in expected turn order.');
	if (entry.profile?.oneHkoChance !== undefined && entry.profile.oneHkoChance >= 0.5) {
		items.push(`High immediate KO pressure (${(entry.profile.oneHkoChance * 100).toFixed(0)}% 1HKO).`);
	} else if (entry.profile?.twoHkoChance !== undefined && entry.profile.twoHkoChance >= 0.8) {
		items.push(`Reliable two-hit pressure (${(entry.profile.twoHkoChance * 100).toFixed(0)}% 2HKO).`);
	}
	items.push(`Role fit: ${entry.role}.`);
	items.push(`Confidence: ${entry.confidence}.`);
	if (entry.score < 0) items.push('Likely loses long HP trade; use as tactical pivot only.');
	return items;
}

function confidenceFromSignals(
	score: number,
	profile: DamageProfile | undefined,
	notes: string[],
): ConfidenceLevel {
	const oneHko = profile?.oneHkoChance ?? 0;
	const twoHko = profile?.twoHkoChance ?? 0;
	const hit = profile?.hitChance ?? 1;
	const setupVolatility = notes.some(n => n.toLowerCase().includes('setup discovered'));
	const scoreMag = Math.abs(score);
	const reliability = (oneHko * 0.6) + (twoHko * 0.3) + (hit * 0.1);
	if (!setupVolatility && scoreMag >= 0.65 && reliability >= 0.7) return 'High';
	if (scoreMag >= 0.3 && reliability >= 0.45) return 'Medium';
	return 'Low';
}

function inferRole(pokemon: BattlePokemon): string {
	const offense = Math.max(pokemon.stats.atk, pokemon.stats.spa);
	const bulk = pokemon.stats.hp + pokemon.stats.def + pokemon.stats.spd;
	const speed = pokemon.stats.spe;
	const statusMoves = pokemon.moves.filter((m) => m.category === 'Status').length;

	if ((bulk >= 900 && offense <= 300) || (statusMoves >= 2 && bulk >= 820)) return 'wall';
	if (offense >= 340 && speed >= 280) return 'cleaner';
	if (offense >= 360 && speed < 280) return 'wallbreaker';
	if (speed >= 300 && offense >= 260) return 'pivot';
	return 'balanced';
}

function roleMatchupBonus(myRole: string, enemyRole: string): number {
	if (myRole === 'wall' && enemyRole === 'cleaner') return 0.06;
	if (myRole === 'cleaner' && enemyRole === 'wallbreaker') return 0.05;
	if (myRole === 'wallbreaker' && enemyRole === 'wall') return 0.08;
	if (myRole === 'pivot' && (enemyRole === 'cleaner' || enemyRole === 'wallbreaker')) return 0.03;
	return 0;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function defensiveReliabilityScore(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	myProfile: DamageProfile | undefined,
	enemyProfile: DamageProfile | undefined,
	enemyMove: MoveEntry | undefined,
): number {
	if (!myProfile || !enemyProfile) return 0;

	const myExpectedFrac = myProfile.expected / Math.max(1, defender.stats.hp);
	const enemyExpectedFrac = enemyProfile.expected / Math.max(1, attacker.stats.hp);

	const myKoRace = (myProfile.oneHkoChance * 0.7) + (myProfile.twoHkoChance * 0.3);
	const enemyKoRace = (enemyProfile.oneHkoChance * 0.7) + (enemyProfile.twoHkoChance * 0.3);

	const expectedDamageEdge = clamp(enemyExpectedFrac <= 0.5 ? 0.5 - enemyExpectedFrac : -(enemyExpectedFrac - 0.5), -0.5, 0.5);
	const koRaceEdge = clamp(myKoRace - enemyKoRace, -1, 1);

	let resistanceEdge = 0;
	if (enemyMove) {
		const attackerTypes = attacker.teraType ? [attacker.teraType] : attacker.species.types;
		const moveMultiplier = typeEffectiveness(typeNormalized(enemyMove.type), attackerTypes.map(typeNormalized));
		if (moveMultiplier < 1) resistanceEdge = 1 - moveMultiplier;
		if (moveMultiplier > 1) resistanceEdge = -(moveMultiplier - 1);
		resistanceEdge = clamp(resistanceEdge, -1, 1);
	}

	const pressureSafetyBlend = (expectedDamageEdge * 0.6) + (koRaceEdge * 0.3) + (resistanceEdge * 0.1);
	return clamp(pressureSafetyBlend, -1, 1);
}

function aggregateOpponentResponse(
	scores: number[],
	weights: number[],
	opponentRiskWeight: number,
): number {
	if (scores.length === 0) return 0;
	const worst = Math.min(...scores);
	const normalizedRisk = clamp(opponentRiskWeight, 0, 1);
	const safeWeights = weights.length === scores.length ? weights : scores.map(() => 1);
	const totalWeight = safeWeights.reduce((sum, w) => sum + Math.max(0.0001, w), 0);
	const weightedAverage = scores.reduce((sum, score, i) => sum + (score * Math.max(0.0001, safeWeights[i])), 0) / Math.max(0.0001, totalWeight);
	return (worst * normalizedRisk) + (weightedAverage * (1 - normalizedRisk));
}

function clampStage(v: number): number {
	return Math.max(-6, Math.min(6, v));
}

function applyBoostDelta(
	pokemon: BattlePokemon,
	delta: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>,
): BattlePokemon {
	const current = pokemon.boosts ?? {};
	return {
		...pokemon,
		boosts: {
			atk: clampStage((current.atk ?? 0) + (delta.atk ?? 0)),
			def: clampStage((current.def ?? 0) + (delta.def ?? 0)),
			spa: clampStage((current.spa ?? 0) + (delta.spa ?? 0)),
			spd: clampStage((current.spd ?? 0) + (delta.spd ?? 0)),
			spe: clampStage((current.spe ?? 0) + (delta.spe ?? 0)),
		},
	};
}

function setupBoostDelta(move: MoveEntry): Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> | undefined {
	if (move.setupBoosts) return move.setupBoosts;
	const name = move.name.toLowerCase();
	const known: Record<string, Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>> = {
		'swords dance': { atk: 2 },
		'nasty plot': { spa: 2 },
		'dragon dance': { atk: 1, spe: 1 },
		'calm mind': { spa: 1, spd: 1 },
		'bulk up': { atk: 1, def: 1 },
		'agility': { spe: 2 },
		'rock polish': { spe: 2 },
		'quiver dance': { spa: 1, spd: 1, spe: 1 },
		'coil': { atk: 1, def: 1 },
		'shift gear': { atk: 1, spe: 2 },
		'work up': { atk: 1, spa: 1 },
		'shell smash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 },
		'curse': { atk: 1, def: 1, spe: -1 },
	};
	return known[name];
}

function isOffensiveSetupMove(move: MoveEntry): boolean {
	if (move.category !== 'Status') return false;
	const delta = setupBoostDelta(move);
	if (!delta) return false;
	return (delta.atk ?? 0) > 0 || (delta.spa ?? 0) > 0 || (delta.spe ?? 0) > 0;
}

function effectiveSpeed(pokemon: BattlePokemon, move?: MoveEntry): number {
	let speed = pokemon.stats.spe;
	if (pokemon.boosts?.spe) speed = Math.floor(speed * stageMultiplier(pokemon.boosts.spe));
	if (pokemon.status === 'par') speed = Math.floor(speed * 0.5);
	if (pokemon.item?.toLowerCase() === 'iron ball') speed = Math.floor(speed * 0.5);
	if (movePriority(move) > 0) {
		// priority is resolved separately
	}
	return speed;
}

function effectiveSpeedWithSide(pokemon: BattlePokemon, side: SideState | undefined, move?: MoveEntry): number {
	let speed = effectiveSpeed(pokemon, move);
	if (side?.stickyWeb && groundedForHazards(pokemon)) {
		speed = Math.floor(speed * (2 / 3));
	}
	return speed;
}

export function hazardSwitchInFraction(defender: BattlePokemon, side?: SideState): number {
	if (!side) return 0;
	let fraction = 0;
	const defTypes = defender.teraType ? [defender.teraType] : defender.species.types;
	if (side.stealthRock) {
		const rockMult = typeEffectiveness('Rock', defTypes);
		fraction += (1 / 8) * rockMult;
	}
	const spikes = side.spikesLayers ?? 0;
	if (spikes > 0) {
		const grounded = !defTypes.includes('Flying');
		if (grounded) {
			if (spikes === 1) fraction += 1 / 8;
			if (spikes === 2) fraction += 1 / 6;
			if (spikes === 3) fraction += 1 / 4;
		}
	}
	return Math.max(0, fraction);
}

function baseDamageWithoutRandom(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	move: MoveEntry,
	battleState: BattleState | undefined,
	attackerOnMySide: boolean,
): number {
	if (move.category === 'Status' || move.basePower === 0) return 0;

	if (defender.ability && DATA_CACHE.abilities) {
		const defAbility = DATA_CACHE.abilities[defender.ability.toLowerCase()];
		if (defAbility?.immuneTo?.includes(move.type)) return 0;
	}

	let power = move.basePower;
	const twoTurnMoves = [
		'Solar Beam', 'SolarBeam', 'Solar Blade', 'SolarBlade', 'Dig', 'Dive',
		'Fly', 'Bounce', 'Skull Bash', 'Razor Wind', 'Ice Burn', 'Sky Attack',
		'Phantom Force', 'Shadow Force', 'Freeze Shock',
	];
	if (twoTurnMoves.some(name => name.toLowerCase() === move.name.toLowerCase())) {
		power = Math.floor(power / 2);
	}

	function maxMovePower(bp: number): number {
		if (bp <= 0) return 0;
		if (bp <= 60) return 90;
		if (bp <= 70) return 100;
		if (bp <= 80) return 100;
		if (bp <= 90) return 110;
		if (bp <= 100) return 120;
		if (bp <= 110) return 130;
		if (bp <= 140) return 140;
		return 150;
	}
	if (attacker.dynamax) power = maxMovePower(power);

	let attackStat = move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
	let defenseStat = move.category === 'Physical' ? defender.stats.def : defender.stats.spd;

	const attackerAbility = attacker.ability?.toLowerCase();
	if (move.category === 'Physical' && attacker.status === 'brn' && attackerAbility !== 'guts') {
		attackStat = Math.floor(attackStat * 0.5);
	}
	if (attackerAbility === 'guts' && attacker.status && move.category === 'Physical') {
		attackStat = Math.floor(attackStat * 1.5);
	}

	if (move.category === 'Physical') {
		attackStat = Math.floor(attackStat * stageMultiplier(attacker.boosts?.atk));
		defenseStat = Math.floor(defenseStat * stageMultiplier(defender.boosts?.def));
	} else {
		attackStat = Math.floor(attackStat * stageMultiplier(attacker.boosts?.spa));
		defenseStat = Math.floor(defenseStat * stageMultiplier(defender.boosts?.spd));
	}

	const defItem = defender.item?.toLowerCase();
	if (defItem === 'eviolite') defenseStat = Math.floor(defenseStat * 1.5);
	if (defItem === 'assault vest' && move.category === 'Special') defenseStat = Math.floor(defenseStat * 1.5);

	const weather = battleState?.weather ?? 'none';
	const defTypes = defender.teraType ? [defender.teraType] : defender.species.types;
	if (weather === 'sand' && move.category === 'Special' && defTypes.includes('Rock')) defenseStat = Math.floor(defenseStat * 1.5);
	if (weather === 'snow' && move.category === 'Physical' && defTypes.includes('Ice')) defenseStat = Math.floor(defenseStat * 1.5);

	const levelFactor = Math.floor((2 * attacker.level) / 5) + 2;
	let base = Math.floor(levelFactor * power * attackStat / Math.max(1, defenseStat)) / 50 + 2;

	if (attacker.ability && DATA_CACHE.abilities) {
		const attAb = DATA_CACHE.abilities[attacker.ability.toLowerCase()];
		if (attAb?.technician && move.basePower > 0 && move.basePower <= 60) {
			base *= 1.5;
		}
	}

	const attTypes = attacker.teraType ? [attacker.teraType] : attacker.species.types;
	let stab = 1.0;
	if (attTypes.includes(move.type)) {
		let adaptability = false;
		if (attacker.ability && DATA_CACHE.abilities) {
			adaptability = !!DATA_CACHE.abilities[attacker.ability.toLowerCase()]?.adaptability;
		}
		stab = (attacker.teraType || adaptability) ? 2.0 : 1.5;
	}

	const normalizedMoveType = typeNormalized(move.type);
	const normalizedDefTypes = defTypes.map(typeNormalized);
	let typeMultiplier = typeEffectiveness(normalizedMoveType, normalizedDefTypes);

	const defAbilityName = defender.ability?.toLowerCase();
	if (defAbilityName === 'thick fat' && (normalizedMoveType === 'Fire' || normalizedMoveType === 'Ice')) {
		typeMultiplier *= 0.5;
	}
	if (defAbilityName === 'dry skin' && normalizedMoveType === 'Fire') {
		typeMultiplier *= 1.25;
	}
	if ((defAbilityName === 'filter' || defAbilityName === 'prism armor' || defAbilityName === 'solid rock') && typeMultiplier > 1) {
		typeMultiplier *= 0.75;
	}
	if (attacker.ability?.toLowerCase() === 'tinted lens' && typeMultiplier > 0 && typeMultiplier < 1) {
		typeMultiplier *= 2;
	}

	let itemMult = 1.0;
	if (attacker.item && DATA_CACHE.items) {
		const item = DATA_CACHE.items[attacker.item.toLowerCase()];
		if (item?.damageMult) itemMult *= item.damageMult;
		if (item?.superEffectiveMult && typeMultiplier > 1.0) itemMult *= item.superEffectiveMult;
	}

	if (weather === 'sun') {
		if (normalizedMoveType === 'Fire') itemMult *= 1.5;
		if (normalizedMoveType === 'Water') itemMult *= 0.5;
	}
	if (weather === 'rain') {
		if (normalizedMoveType === 'Water') itemMult *= 1.5;
		if (normalizedMoveType === 'Fire') itemMult *= 0.5;
	}
	const terrain = battleState?.terrain ?? 'none';
	if (terrain === 'electric' && normalizedMoveType === 'Electric') itemMult *= 1.3;
	if (terrain === 'grassy' && normalizedMoveType === 'Grass') itemMult *= 1.3;
	if (terrain === 'psychic' && normalizedMoveType === 'Psychic') itemMult *= 1.3;

	const defenderSide = getSideForDefender(attackerOnMySide, battleState);
	if (move.category === 'Physical' && defenderSide?.reflect) itemMult *= 0.5;
	if (move.category === 'Special' && defenderSide?.lightScreen) itemMult *= 0.5;

	if (defAbilityName === 'multiscale' || defAbilityName === 'shadow shield') itemMult *= 0.5;
	if (defAbilityName === 'fur coat' && move.category === 'Physical') itemMult *= 0.5;

	return Math.max(0, base * stab * typeMultiplier * itemMult);
}

function computeDamageProfile(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	move: MoveEntry,
	battleState: BattleState | undefined,
	attackerOnMySide: boolean,
): DamageProfile {
	const baseNoRandom = baseDamageWithoutRandom(attacker, defender, move, battleState, attackerOnMySide);
	const accPct = move.accuracy === true ? 100 : Math.max(0, Math.min(100, move.accuracy));
	const actionChance = statusActionChance(attacker);
	const hitChance = (accPct / 100) * actionChance;

	const rollFactors = Array.from({ length: 16 }, (_, i) => (85 + i) / 100);
	const distribution: Array<{ damage: number; prob: number }> = [];
	for (const roll of rollFactors) {
		distribution.push({ damage: Math.max(0, Math.floor(baseNoRandom * roll)), prob: hitChance / rollFactors.length });
	}
	distribution.push({ damage: 0, prob: 1 - hitChance });

	const min = baseNoRandom <= 0 ? 0 : Math.floor(baseNoRandom * 0.85);
	const max = baseNoRandom <= 0 ? 0 : Math.floor(baseNoRandom);
	const expected = distribution.reduce((sum, p) => sum + p.damage * p.prob, 0);

	const hp = defender.stats.hp;
	const oneHkoChance = distribution.reduce((sum, p) => sum + (p.damage >= hp ? p.prob : 0), 0);

	let twoHkoChance = 0;
	for (const p1 of distribution) {
		for (const p2 of distribution) {
			if (p1.damage + p2.damage >= hp) {
				twoHkoChance += p1.prob * p2.prob;
			}
		}
	}

	return {
		min,
		max,
		expected,
		hitChance,
		oneHkoChance: Math.min(1, Math.max(0, oneHkoChance)),
		twoHkoChance: Math.min(1, Math.max(0, twoHkoChance)),
		distribution,
	};
}

function expectedDamage(attacker: BattlePokemon, defender: BattlePokemon, move: MoveEntry, battleState?: BattleState, attackerOnMySide = true): number {
	return computeDamageProfile(attacker, defender, move, battleState, attackerOnMySide).expected;
}

function pickBestMove(attacker: BattlePokemon, defender: BattlePokemon, battleState?: BattleState, attackerOnMySide = true): { move?: MoveEntry; fraction: number; profile?: DamageProfile } {
	let best: MoveEntry | undefined;
	let bestFraction = 0;
	let bestProfile: DamageProfile | undefined;
	for (const move of attacker.moves) {
		const profile = computeDamageProfile(attacker, defender, move, battleState, attackerOnMySide);
		const frac = profile.expected / defender.stats.hp;
		if (frac > bestFraction) {
			bestFraction = frac;
			best = move;
			bestProfile = profile;
		}
	}
	return { move: best, fraction: bestFraction, profile: bestProfile };
}

type DoublesAction = {
	move?: MoveEntry;
	target: 'slot1' | 'slot2' | 'both' | 'support';
	expectedDamage: number;
	expectedFraction: number;
	supportValue: number;
	primaryProfile?: DamageProfile;
	secondaryProfile?: DamageProfile;
	notes: string[];
};

const SPREAD_MOVE_IDS = new Set<string>([
	'rockslide', 'heatwave', 'dazzlinggleam', 'muddywater', 'surf', 'earthquake', 'discharge', 'blizzard',
	'snarl', 'icywind', 'electroweb', 'breakingswipe', 'makeitrain', 'eruption', 'waterspout', 'boomburst',
]);

const PROTECT_IDS = new Set<string>(['protect', 'detect', 'spikyshield', 'kingsshield', 'banefulbunker', 'silktrap']);

function moveId(name?: string): string {
	return name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

function hasMoveId(pokemon: BattlePokemon, id: string): boolean {
	return pokemon.moves.some((m) => moveId(m.name) === id);
}

function hasOffensiveMoveType(pokemon: BattlePokemon, type: string): boolean {
	return pokemon.moves.some((m) => m.category !== 'Status' && typeNormalized(m.type) === typeNormalized(type));
}

function hasType(pokemon: BattlePokemon, type: string): boolean {
	const types = pokemon.teraType ? [pokemon.teraType] : pokemon.species.types;
	return types.includes(type);
}

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

function pairCombinations(team: BattlePokemon[]): Array<[BattlePokemon, BattlePokemon]> {
	const pairs: Array<[BattlePokemon, BattlePokemon]> = [];
	for (let i = 0; i < team.length; i++) {
		for (let j = i + 1; j < team.length; j++) {
			pairs.push([team[i], team[j]]);
		}
	}
	if (pairs.length === 0 && team.length === 1) {
		pairs.push([team[0], team[0]]);
	}
	return pairs;
}

function evaluate2v2(
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

	const myGhostCount = [my1, my2].filter((p) => {
		return hasType(p, 'Ghost');
	}).length;

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

function expectedTurnOrder(
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

	// Planned setup turns.
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

	// Remaining turns: attack with boosted stats.
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

function evaluate1v1(
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

	// Discover setup plans (status boosting + follow-up attack) and compare.
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

*/
