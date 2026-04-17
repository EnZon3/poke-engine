import type { SpeciesEntry, Stats } from '../types.js';
import { toID } from '../utils.js';

function formatPokemonName(name: string): string {
	return name
		.split('-')
		.map(part => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
		.join(' ');
}

function mapPokeAPIStats(stats: any[]): Stats {
	const mapped: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
	for (const stat of stats || []) {
		const statName = stat?.stat?.name;
		const value = stat?.base_stat;
		if (typeof value !== 'number') continue;
		switch (statName) {
			case 'hp': mapped.hp = value; break;
			case 'attack': mapped.atk = value; break;
			case 'defense': mapped.def = value; break;
			case 'special-attack': mapped.spa = value; break;
			case 'special-defense': mapped.spd = value; break;
			case 'speed': mapped.spe = value; break;
		}
	}
	return mapped;
}

export function addPokeAPISpeciesEntry(species: Record<string, SpeciesEntry>, pkmn: any): void {
	if (!pkmn?.name || !Array.isArray(pkmn?.types) || !Array.isArray(pkmn?.stats)) return;
	const sortedTypes = [...pkmn.types].sort((a: any, b: any) => (a.slot ?? 0) - (b.slot ?? 0));
	const types = sortedTypes.map((t: any) => {
		const n = String(t?.type?.name || '');
		return n ? n.charAt(0).toUpperCase() + n.slice(1) : n;
	}).filter(Boolean);
	const entry: SpeciesEntry = {
		name: formatPokemonName(String(pkmn.name)),
		types,
		baseStats: mapPokeAPIStats(pkmn.stats),
		defaultAbility: undefined,
	};
	const aliases = [String(pkmn.name), String(pkmn.resolved_name ?? '')].filter(Boolean);
	for (const alias of aliases) {
		species[alias.toLowerCase()] = entry;
		species[toID(alias)] = entry;
	}
}

export function normalizeShowdownSpecies(
	species: Record<string, SpeciesEntry>,
	pokedexRaw: Record<string, any>,
): void {
	for (const key of Object.keys(pokedexRaw)) {
		const entry = pokedexRaw[key];
		if (entry.name && entry.types && entry.baseStats) {
			const speciesEntry: SpeciesEntry = {
				name: entry.name,
				types: entry.types,
				baseStats: entry.baseStats,
				defaultAbility: typeof entry.abilities?.['0'] === 'string' ? entry.abilities['0'] : undefined,
			};
			species[entry.name.toLowerCase()] = speciesEntry;
			species[toID(entry.name)] = speciesEntry;
			species[toID(key)] = speciesEntry;
		}
	}
}
