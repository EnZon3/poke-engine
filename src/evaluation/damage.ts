import { getDataCache } from '../data.js';
import { typeEffectiveness } from '../mechanics.js';
import type { BattlePokemon, BattleState, MoveEntry } from '../types.js';
import { getSideForDefender, stageMultiplier, statusActionChance, typeNormalized } from './helpers.js';
import type { DamageProfile } from './types.js';

function resolvedHitCount(move: MoveEntry): number {
	if (typeof move.multiHit === 'number') return Math.max(1, move.multiHit);
	if (Array.isArray(move.multiHit)) {
		const minHits = Math.max(1, Math.floor(move.multiHit[0]));
		const maxHits = Math.max(minHits, Math.floor(move.multiHit[1]));
		// Competitive default distribution for 2-5 hit moves is centered at 3 hits.
		if (minHits === 2 && maxHits === 5) return 3;
		return Math.max(1, Math.round((minHits + maxHits) / 2));
	}
	return 1;
}

function convolveDamageDistribution(
	perHit: Array<{ damage: number; prob: number }>,
	hits: number,
): Array<{ damage: number; prob: number }> {
	let dist = [{ damage: 0, prob: 1 }];
	for (let i = 0; i < hits; i++) {
		const next = new Map<number, number>();
		for (const a of dist) {
			for (const b of perHit) {
				const totalDamage = a.damage + b.damage;
				next.set(totalDamage, (next.get(totalDamage) ?? 0) + (a.prob * b.prob));
			}
		}
		dist = Array.from(next.entries()).map(([damage, prob]) => ({ damage, prob }));
	}
	return dist;
}

export function baseDamageWithoutRandom(
	attacker: BattlePokemon,
	defender: BattlePokemon,
	move: MoveEntry,
	battleState: BattleState | undefined,
	attackerOnMySide: boolean,
): number {
	const cache = getDataCache();
	if (move.category === 'Status' || move.basePower === 0) return 0;

	if (defender.ability && cache.abilities) {
		const defAbility = cache.abilities[defender.ability.toLowerCase()];
		if (defAbility?.immuneTo?.includes(move.type)) return 0;
	}

	let power = move.basePower;
	const normalizedMoveType = typeNormalized(move.type);
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
		const isFightingOrPoison = normalizedMoveType === 'Fighting' || normalizedMoveType === 'Poison';
		if (isFightingOrPoison) {
			if (bp <= 40) return 70;
			if (bp <= 50) return 75;
			if (bp <= 60) return 80;
			if (bp <= 70) return 85;
			if (bp <= 100) return 90;
			if (bp <= 140) return 95;
			return 100;
		}
		if (bp <= 40) return 90;
		if (bp <= 50) return 100;
		if (bp <= 60) return 110;
		if (bp <= 70) return 120;
		if (bp <= 100) return 130;
		if (bp <= 140) return 140;
		return 150;
	}
	if (attacker.dynamax) {
		power = move.maxMoveBasePower ?? maxMovePower(power);
	}

	let attackStat = move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
	let defenseStat = move.category === 'Physical' ? defender.stats.def : defender.stats.spd;

	const attackerAbility = attacker.ability?.toLowerCase();
	const defenderAbility = defender.ability?.toLowerCase();
	const criticalBlocked = defenderAbility === 'battle armor' || defenderAbility === 'shell armor';
	const isCritical = !!move.willCrit && !criticalBlocked;
	if (move.category === 'Physical' && attacker.status === 'brn' && attackerAbility !== 'guts') {
		attackStat = Math.floor(attackStat * 0.5);
	}
	if (attackerAbility === 'guts' && attacker.status && move.category === 'Physical') {
		attackStat = Math.floor(attackStat * 1.5);
	}

	const attackStage = move.category === 'Physical' ? (attacker.boosts?.atk ?? 0) : (attacker.boosts?.spa ?? 0);
	const defenseStage = move.category === 'Physical' ? (defender.boosts?.def ?? 0) : (defender.boosts?.spd ?? 0);
	const appliedAttackStage = isCritical ? Math.max(0, attackStage) : attackStage;
	const appliedDefenseStage = isCritical ? Math.min(0, defenseStage) : defenseStage;

	if (move.category === 'Physical') {
		attackStat = Math.floor(attackStat * stageMultiplier(appliedAttackStage));
		defenseStat = Math.floor(defenseStat * stageMultiplier(appliedDefenseStage));
	} else {
		attackStat = Math.floor(attackStat * stageMultiplier(appliedAttackStage));
		defenseStat = Math.floor(defenseStat * stageMultiplier(appliedDefenseStage));
	}

	const defItem = defender.item?.toLowerCase();
	if (defItem === 'eviolite') defenseStat = Math.floor(defenseStat * 1.5);
	if (defItem === 'assault vest' && move.category === 'Special') defenseStat = Math.floor(defenseStat * 1.5);

	const weather = battleState?.weather ?? 'none';
	const defTypes = defender.teraType ? [defender.teraType] : defender.species.types;
	if (weather === 'sand' && move.category === 'Special' && defTypes.includes('Rock')) defenseStat = Math.floor(defenseStat * 1.5);
	if (weather === 'snow' && move.category === 'Physical' && defTypes.includes('Ice')) defenseStat = Math.floor(defenseStat * 1.5);

	const levelFactor = Math.floor((2 * attacker.level) / 5) + 2;
	let base = Math.floor(Math.floor(levelFactor * power * attackStat / Math.max(1, defenseStat)) / 50) + 2;

	if (attacker.ability && cache.abilities) {
		const attAb = cache.abilities[attacker.ability.toLowerCase()];
		if (attAb?.technician && move.basePower > 0 && move.basePower <= 60) {
			base *= 1.5;
		}
	}

	const baseTypes = attacker.species.types;
	const teraType = attacker.teraType;
	const hasBaseTypeStab = baseTypes.includes(move.type);
	const hasTeraTypeStab = !!teraType && teraType === move.type;
	let adaptability = false;
	if (attacker.ability && cache.abilities) {
		adaptability = !!cache.abilities[attacker.ability.toLowerCase()]?.adaptability;
	}

	let stab = 1.0;
	if (teraType) {
		if (hasTeraTypeStab && hasBaseTypeStab) {
			stab = adaptability ? 2.25 : 2.0;
		} else if (hasTeraTypeStab || hasBaseTypeStab) {
			stab = adaptability ? 2.0 : 1.5;
		}
	} else if (hasBaseTypeStab) {
		stab = adaptability ? 2.0 : 1.5;
	}

	const normalizedDefTypes = defTypes.map(typeNormalized);
	let typeMultiplier = typeEffectiveness(normalizedMoveType, normalizedDefTypes);

	if (defenderAbility === 'thick fat' && (normalizedMoveType === 'Fire' || normalizedMoveType === 'Ice')) {
		typeMultiplier *= 0.5;
	}
	if (defenderAbility === 'dry skin' && normalizedMoveType === 'Fire') {
		typeMultiplier *= 1.25;
	}
	if ((defenderAbility === 'filter' || defenderAbility === 'prism armor' || defenderAbility === 'solid rock') && typeMultiplier > 1) {
		typeMultiplier *= 0.75;
	}
	if (attacker.ability?.toLowerCase() === 'tinted lens' && typeMultiplier > 0 && typeMultiplier < 1) {
		typeMultiplier *= 2;
	}

	let itemMult = 1.0;
	if (attacker.item && cache.items) {
		const item = cache.items[attacker.item.toLowerCase()];
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

	if (defenderAbility === 'multiscale' || defenderAbility === 'shadow shield') itemMult *= 0.5;
	if (defenderAbility === 'fur coat' && move.category === 'Physical') itemMult *= 0.5;

	let critMultiplier = 1;
	if (isCritical) {
		critMultiplier = 1.5;
		if (attackerAbility === 'sniper') critMultiplier *= 1.5;
	}

	return Math.max(0, base * stab * typeMultiplier * itemMult * critMultiplier);
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
	const hits = resolvedHitCount(move);

	const rollFactors = Array.from({ length: 16 }, (_, i) => (85 + i) / 100);
	const perHitRolls: Array<{ damage: number; prob: number }> = [];
	for (const roll of rollFactors) {
		perHitRolls.push({ damage: Math.max(0, Math.floor(baseNoRandom * roll)), prob: 1 / rollFactors.length });
	}

	const multiHitDist = convolveDamageDistribution(perHitRolls, hits);
	const distribution = multiHitDist.map((entry) => ({ damage: entry.damage, prob: entry.prob * hitChance }));
	distribution.push({ damage: 0, prob: Math.max(0, 1 - hitChance) });

	const minPerHit = baseNoRandom <= 0 ? 0 : Math.floor(baseNoRandom * 0.85);
	const maxPerHit = baseNoRandom <= 0 ? 0 : Math.floor(baseNoRandom);
	const min = minPerHit * hits;
	const max = maxPerHit * hits;
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
