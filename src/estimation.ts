import { DATA_CACHE, resolveSpecies } from './data.js';
import type { PokemonSet, Stats } from './types.js';

type SpreadEstimate = {
	ivs: Stats;
	evs: Stats;
	reason: string;
};

function statBlock(values: Partial<Stats> = {}): Stats {
	return {
		hp: values.hp ?? 0,
		atk: values.atk ?? 0,
		def: values.def ?? 0,
		spa: values.spa ?? 0,
		spd: values.spd ?? 0,
		spe: values.spe ?? 0,
	};
}

function clampEv(v: number): number {
	const c = Math.max(0, Math.min(252, Math.floor(v / 4) * 4));
	return c;
}

function evTotal(evs: Stats): number {
	return evs.hp + evs.atk + evs.def + evs.spa + evs.spd + evs.spe;
}

function moveCategoryCounts(set: PokemonSet): { physical: number; special: number; status: number } {
	let physical = 0;
	let special = 0;
	let status = 0;
	for (const moveName of set.moves) {
		const move = DATA_CACHE.moves?.[moveName.toLowerCase()];
		if (!move) continue;
		if (move.category === 'Physical') physical++;
		else if (move.category === 'Special') special++;
		else status++;
	}
	return { physical, special, status };
}

export function estimateSpreadForSet(set: PokemonSet): SpreadEstimate {
	const species = resolveSpecies(set.species);
	const counts = moveCategoryCounts(set);
	const baseSpe = species?.baseStats.spe ?? 80;
	const baseAtk = species?.baseStats.atk ?? 80;
	const baseSpa = species?.baseStats.spa ?? 80;
	const bulky = (species?.baseStats.hp ?? 80) + (species?.baseStats.def ?? 80) + (species?.baseStats.spd ?? 80) >= 290;
	const fast = baseSpe >= 95;
	const physicalBias = counts.physical > counts.special || (counts.physical === counts.special && baseAtk > baseSpa);
	const specialBias = counts.special > counts.physical || (counts.physical === counts.special && baseSpa >= baseAtk);

	let evs = statBlock({ hp: 4 });
	if (physicalBias && !specialBias) {
		evs.atk = 252;
	} else if (specialBias && !physicalBias) {
		evs.spa = 252;
	} else {
		evs.atk = 128;
		evs.spa = 128;
	}

	if (fast) {
		evs.spe = 252;
	} else if (bulky) {
		evs.hp = 252;
	} else {
		evs.spe = 164;
		evs.hp = Math.max(evs.hp, 84);
	}

	if (evTotal(evs) > 508) {
		// trim from HP first, then speed, then mixed attack spillover.
		let overflow = evTotal(evs) - 508;
		const order: (keyof Stats)[] = ['hp', 'spe', 'atk', 'spa', 'def', 'spd'];
		for (const k of order) {
			if (overflow <= 0) break;
			const cut = Math.min(evs[k], Math.ceil(overflow / 4) * 4);
			evs[k] -= cut;
			overflow -= cut;
		}
	}

	evs = statBlock({
		hp: clampEv(evs.hp),
		atk: clampEv(evs.atk),
		def: clampEv(evs.def),
		spa: clampEv(evs.spa),
		spd: clampEv(evs.spd),
		spe: clampEv(evs.spe),
	});

	const ivs = statBlock({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
	if (counts.physical === 0 && counts.special > 0) {
		ivs.atk = 0;
	}

	const style = physicalBias && !specialBias ? 'physical' : specialBias && !physicalBias ? 'special' : 'mixed';
	const speedStyle = fast ? 'fast' : bulky ? 'bulky' : 'balanced';
	return {
		ivs,
		evs,
		reason: `${style}/${speedStyle} heuristic from moves + species base stats`,
	};
}

function isZeroStats(stats: Stats): boolean {
	return stats.hp === 0 && stats.atk === 0 && stats.def === 0 && stats.spa === 0 && stats.spd === 0 && stats.spe === 0;
}

export function applyEstimatedSpread(set: PokemonSet, force = false): PokemonSet {
	const shouldReplace = force || isZeroStats(set.ivs) || isZeroStats(set.evs);
	if (!shouldReplace) return set;
	const estimate = estimateSpreadForSet(set);
	return {
		...set,
		ivs: estimate.ivs,
		evs: estimate.evs,
	};
}

export function applyEstimatedSpreadsToTeam(team: PokemonSet[], force = false): PokemonSet[] {
	return team.map(p => applyEstimatedSpread(p, force));
}
