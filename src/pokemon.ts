import { DATA_CACHE, resolveSpecies } from './data.js';
import { natureModifier } from './mechanics.js';
import { toID } from './utils.js';
import type { BattlePokemon, PokemonSet, Stats } from './types.js';

export function calculateStat(base: number, iv: number, ev: number, level: number, natureMult: number, isHP: boolean): number {
	const intermediate = ((2 * base + iv + Math.floor(ev / 4)) * level) / 100;
	if (isHP) return Math.floor(intermediate + level + 10);
	return Math.floor((intermediate + 5) * natureMult);
}

export function buildPokemon(set: PokemonSet): BattlePokemon {
	if (!DATA_CACHE.species || !DATA_CACHE.moves) {
		throw new Error('Data not loaded; call loadData() first');
	}
	const speciesEntry = resolveSpecies(set.species);
	if (!speciesEntry) {
		throw new Error(`Unknown species: ${set.species}`);
	}

	const finalStats: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as (keyof Stats)[]) {
		const base = speciesEntry.baseStats[stat];
		const iv = set.ivs[stat];
		const ev = set.evs[stat];
		const modifier = natureModifier(set.nature, stat);
		finalStats[stat] = calculateStat(base, iv, ev, set.level, modifier, stat === 'hp');
	}

	if (set.ability && DATA_CACHE.abilities) {
		const ability = DATA_CACHE.abilities[set.ability.toLowerCase()];
		if (ability?.doubleAttack) {
			finalStats.atk = Math.floor(finalStats.atk * 2);
		}
	}

	if (set.item && DATA_CACHE.items) {
		const item = DATA_CACHE.items[set.item.toLowerCase()];
		if (item) {
			if (item.attackMult) finalStats.atk = Math.floor(finalStats.atk * item.attackMult);
			if (item.spAttackMult) finalStats.spa = Math.floor(finalStats.spa * item.spAttackMult);
			if (item.speedMult) finalStats.spe = Math.floor(finalStats.spe * item.speedMult);
		}
	}

	if (set.status === 'par') {
		finalStats.spe = Math.floor(finalStats.spe * 0.5);
	}
	if (set.dynamax) {
		finalStats.hp *= 2;
	}

	const resolvedMoves = set.moves
		.map(moveName => DATA_CACHE.moves?.[moveName.toLowerCase()] || DATA_CACHE.moves?.[toID(moveName)])
		.filter((move): move is NonNullable<typeof move> => !!move);

	return {
		species: speciesEntry,
		level: set.level,
		nature: set.nature,
		stats: finalStats,
		moves: resolvedMoves,
		ability: set.ability,
		item: set.item,
		teraType: set.teraType,
		dynamax: set.dynamax,
		status: set.status ?? null,
		boosts: set.boosts,
	};
}
