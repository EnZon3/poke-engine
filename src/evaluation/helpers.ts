import { typeEffectiveness } from '../mechanics.js';
import type { BattlePokemon, BattleState, EvaluationOptions, MoveEntry, SideState } from '../types.js';
import { MODE_PRESETS } from './config.js';
import type { ConfidenceLevel, DamageProfile } from './types.js';

export function stageMultiplier(stageRaw?: number): number {
	const stage = Math.max(-6, Math.min(6, stageRaw ?? 0));
	if (stage >= 0) return (2 + stage) / 2;
	return 2 / (2 - stage);
}

export function getSideForDefender(attackerOnMySide: boolean, battleState?: BattleState): SideState | undefined {
	if (!battleState) return undefined;
	return attackerOnMySide ? battleState.enemySide : battleState.mySide;
}

export function typeNormalized(t: string): string {
	if (!t) return t;
	return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function movePriority(move?: MoveEntry): number {
	return move?.priority ?? 0;
}

export function residualFraction(pokemon: BattlePokemon): number {
	const item = pokemon.item?.toLowerCase();
	if (item === 'leftovers' || item === 'black sludge') return -1 / 16;
	if (pokemon.status === 'brn') return 1 / 16;
	if (pokemon.status === 'psn' || pokemon.status === 'tox') return 1 / 8;
	return 0;
}

export function groundedForHazards(pokemon: BattlePokemon): boolean {
	const defTypes = pokemon.teraType ? [pokemon.teraType] : pokemon.species.types;
	return !defTypes.includes('Flying');
}

export function statusActionChance(pokemon: BattlePokemon): number {
	let chance = 1;
	if (pokemon.status === 'par') chance *= 0.75;
	if (pokemon.status === 'slp') chance *= 0.33;
	if (pokemon.status === 'frz') chance *= 0.2;
	return chance;
}

export function modePreset(options: EvaluationOptions): Required<Pick<EvaluationOptions, 'lookaheadTurns' | 'defensiveWeight' | 'opponentRiskWeight'>> {
	if (options.mode === 'competitive') {
		return {
			lookaheadTurns: options.lookaheadTurns ?? MODE_PRESETS.competitive.lookaheadTurns,
			defensiveWeight: options.defensiveWeight ?? MODE_PRESETS.competitive.defensiveWeight,
			opponentRiskWeight: options.opponentRiskWeight ?? MODE_PRESETS.competitive.opponentRiskWeight,
		};
	}
	if (options.mode === 'casual') {
		return {
			lookaheadTurns: options.lookaheadTurns ?? MODE_PRESETS.casual.lookaheadTurns,
			defensiveWeight: options.defensiveWeight ?? MODE_PRESETS.casual.defensiveWeight,
			opponentRiskWeight: options.opponentRiskWeight ?? MODE_PRESETS.casual.opponentRiskWeight,
		};
	}
	return {
		lookaheadTurns: options.lookaheadTurns ?? MODE_PRESETS.custom.lookaheadTurns,
		defensiveWeight: options.defensiveWeight ?? MODE_PRESETS.custom.defensiveWeight,
		opponentRiskWeight: options.opponentRiskWeight ?? MODE_PRESETS.custom.opponentRiskWeight,
	};
}

export function buildRationale(entry: {
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

export function confidenceFromSignals(
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

export function inferRole(pokemon: BattlePokemon): string {
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

export function roleMatchupBonus(myRole: string, enemyRole: string): number {
	if (myRole === 'wall' && enemyRole === 'cleaner') return 0.06;
	if (myRole === 'cleaner' && enemyRole === 'wallbreaker') return 0.05;
	if (myRole === 'wallbreaker' && enemyRole === 'wall') return 0.08;
	if (myRole === 'pivot' && (enemyRole === 'cleaner' || enemyRole === 'wallbreaker')) return 0.03;
	return 0;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function defensiveReliabilityScore(
	attacker: BattlePokemon,
	_defender: BattlePokemon,
	myProfile: DamageProfile | undefined,
	enemyProfile: DamageProfile | undefined,
	enemyMove: MoveEntry | undefined,
): number {
	if (!myProfile || !enemyProfile) return 0;

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

export function aggregateOpponentResponse(
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

export function clampStage(v: number): number {
	return Math.max(-6, Math.min(6, v));
}

export function applyBoostDelta(
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

export function setupBoostDelta(move: MoveEntry): Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> | undefined {
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

export function isOffensiveSetupMove(move: MoveEntry): boolean {
	if (move.category !== 'Status') return false;
	const delta = setupBoostDelta(move);
	if (!delta) return false;
	return (delta.atk ?? 0) > 0 || (delta.spa ?? 0) > 0 || (delta.spe ?? 0) > 0;
}

export function effectiveSpeed(pokemon: BattlePokemon, move?: MoveEntry): number {
	let speed = pokemon.stats.spe;
	if (pokemon.boosts?.spe) speed = Math.floor(speed * stageMultiplier(pokemon.boosts.spe));
	if (pokemon.status === 'par') speed = Math.floor(speed * 0.5);
	if (pokemon.item?.toLowerCase() === 'iron ball') speed = Math.floor(speed * 0.5);
	if (movePriority(move) > 0) {
		// priority is resolved separately
	}
	return speed;
}

export function effectiveSpeedWithSide(pokemon: BattlePokemon, side: SideState | undefined, move?: MoveEntry): number {
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

export function moveId(name?: string): string {
	return name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

export function hasMoveId(pokemon: BattlePokemon, id: string): boolean {
	return pokemon.moves.some((m) => moveId(m.name) === id);
}

export function hasOffensiveMoveType(pokemon: BattlePokemon, type: string): boolean {
	return pokemon.moves.some((m) => m.category !== 'Status' && typeNormalized(m.type) === typeNormalized(type));
}

export function hasType(pokemon: BattlePokemon, type: string): boolean {
	const types = pokemon.teraType ? [pokemon.teraType] : pokemon.species.types;
	return types.includes(type);
}

export function pairCombinations(team: BattlePokemon[]): Array<[BattlePokemon, BattlePokemon]> {
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
