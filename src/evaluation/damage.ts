import { DATA_CACHE } from '../data.js';
import { typeEffectiveness } from '../mechanics.js';
import type { BattlePokemon, BattleState, MoveEntry } from '../types.js';
import { clamp, getSideForDefender, stageMultiplier, statusActionChance, typeNormalized } from './helpers.js';
import type { DamageProfile } from './types.js';

export function baseDamageWithoutRandom(
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

export function computeDamageProfile(
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

export function expectedDamage(attacker: BattlePokemon, defender: BattlePokemon, move: MoveEntry, battleState?: BattleState, attackerOnMySide = true): number {
	return computeDamageProfile(attacker, defender, move, battleState, attackerOnMySide).expected;
}

export function pickBestMove(attacker: BattlePokemon, defender: BattlePokemon, battleState?: BattleState, attackerOnMySide = true): { move?: MoveEntry; fraction: number; profile?: DamageProfile } {
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
