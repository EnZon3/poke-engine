import type { AbilityEntry, DataCache, DataSource, ItemEntry, MoveEntry, SpeciesEntry, Stats } from './types.js';
import { toID } from './utils.js';

export const DATA_CACHE: DataCache = {};
export let ACTIVE_GENERATION = 9;

export function setActiveGeneration(gen?: number): void {
	ACTIVE_GENERATION = gen ?? 9;
}

async function fetchJSON(name: string): Promise<any> {
	const url = `https://play.pokemonshowdown.com/data/${name}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${name}: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

async function fetchJSONWithFallback(primary: string, fallback: string): Promise<any> {
	try {
		return await fetchJSON(primary);
	} catch {
		return fetchJSON(fallback);
	}
}

async function fetchPokeAPI(path: string): Promise<any> {
	const url = `https://pokeapi.co/api/v2/${path}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch PokeAPI ${path}: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

async function fetchPokeAPISafe(path: string): Promise<any | null> {
	const url = `https://pokeapi.co/api/v2/${path}`;
	const res = await fetch(url);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Failed to fetch PokeAPI ${path}: ${res.status} ${res.statusText}`);
	return res.json();
}

async function fetchPokemonEntry(speciesName: string): Promise<any | null> {
	const direct = await fetchPokeAPISafe(`pokemon/${speciesName}`);
	if (direct) return direct;
	const speciesData = await fetchPokeAPISafe(`pokemon-species/${speciesName}`);
	if (!speciesData) return null;
	const defaultVariety = (speciesData.varieties as any[] | undefined)?.find((v: any) => v.is_default === true);
	const defaultName: string | undefined = defaultVariety?.pokemon?.name;
	if (!defaultName || defaultName === speciesName) return null;
	return fetchPokeAPISafe(`pokemon/${defaultName}`);
}

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

async function loadSpeciesFromPokeAPI(gen?: number): Promise<Record<string, SpeciesEntry>> {
	const generation = gen ?? 9;
	const genRaw = await fetchPokeAPI(`generation/${generation}`);
	const speciesList: string[] = (genRaw?.pokemon_species || []).map((s: any) => s?.name).filter(Boolean);
	if (speciesList.length === 0) {
		throw new Error(`PokeAPI returned no species for generation ${generation}.`);
	}

	const species: Record<string, SpeciesEntry> = {};
	const chunkSize = 25;
	for (let i = 0; i < speciesList.length; i += chunkSize) {
		const chunk = speciesList.slice(i, i + chunkSize);
		const pokemonEntries = await Promise.all(chunk.map(name => fetchPokemonEntry(name)));
		for (const pkmn of pokemonEntries) {
			if (!pkmn?.name || !Array.isArray(pkmn?.types) || !Array.isArray(pkmn?.stats)) continue;
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
			species[String(pkmn.name).toLowerCase()] = entry;
			species[toID(String(pkmn.name))] = entry;
		}
	}

	return species;
}

export async function loadData(gen?: number, dataSource: DataSource = 'showdown'): Promise<void> {
	setActiveGeneration(gen);
	if (DATA_CACHE.species && DATA_CACHE.moves && DATA_CACHE.abilities && DATA_CACHE.items) {
		return;
	}
	if (gen !== undefined && (gen < 1 || gen > 9)) {
		throw new Error(`Invalid generation ${gen}. Expected a value between 1 and 9.`);
	}
	const prefix = gen ? `mods/gen${gen}/` : '';
	const species: Record<string, SpeciesEntry> = dataSource === 'pokeapi'
		? await loadSpeciesFromPokeAPI(gen)
		: {};

	const [pokedexRaw, movesRaw, abilitiesRaw, itemsRaw] = await Promise.all([
		dataSource === 'showdown'
			? (gen ? fetchJSONWithFallback(`${prefix}pokedex.json`, 'pokedex.json') : fetchJSON('pokedex.json'))
			: Promise.resolve({}),
		gen ? fetchJSONWithFallback(`${prefix}moves.json`, 'moves.json') : fetchJSON('moves.json'),
		(async () => {
			try {
				return gen ? await fetchJSONWithFallback(`${prefix}abilities.json`, 'abilities.json') : await fetchJSON('abilities.json');
			} catch {
				return {};
			}
		})(),
		(async () => {
			try {
				return gen ? await fetchJSONWithFallback(`${prefix}items.json`, 'items.json') : await fetchJSON('items.json');
			} catch {
				return {};
			}
		})(),
	]);

	if (dataSource === 'showdown') {
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

	const moves: Record<string, MoveEntry> = {};
	for (const key of Object.keys(movesRaw)) {
		const entry = movesRaw[key];
		if (!entry || !entry.name) continue;
		const setupBoosts = (entry?.boosts ?? entry?.self?.boosts) as Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> | undefined;
		const move: MoveEntry = {
			name: entry.name,
			type: entry.type,
			basePower: entry.basePower || 0,
			maxMoveBasePower: typeof entry.maxMove?.basePower === 'number' ? entry.maxMove.basePower : undefined,
			category: entry.category,
			accuracy: entry.accuracy,
			willCrit: !!entry.willCrit,
			critRatio: typeof entry.critRatio === 'number' ? entry.critRatio : undefined,
			multiHit: typeof entry.multihit === 'number'
				? entry.multihit
				: (Array.isArray(entry.multihit)
					&& entry.multihit.length === 2
					&& typeof entry.multihit[0] === 'number'
					&& typeof entry.multihit[1] === 'number'
						? [entry.multihit[0], entry.multihit[1]]
						: undefined),
			multiAccuracy: !!entry.multiaccuracy,
			priority: typeof entry.priority === 'number' ? entry.priority : 0,
			recoil: !!entry.recoil,
			drain: !!entry.drain,
			setupBoosts,
		};
		moves[entry.name.toLowerCase()] = move;
		moves[toID(entry.name)] = move;
		moves[toID(key)] = move;
	}

	const abilities: Record<string, AbilityEntry> = {};
	for (const key of Object.keys(abilitiesRaw)) {
		const entry = abilitiesRaw[key];
		if (!entry || !entry.name) continue;
		const nameLower = entry.name.toLowerCase();
		const ab: AbilityEntry = { name: entry.name };
		const simpleName = entry.name.toLowerCase();
		if (simpleName === 'huge power' || simpleName === 'pure power') ab.doubleAttack = true;
		if (simpleName === 'technician') ab.technician = true;
		if (simpleName === 'adaptability') ab.adaptability = true;
		const immunityMap: Record<string, string[]> = {
			levitate: ['Ground'],
			'flash fire': ['Fire'],
			'water absorb': ['Water'],
			'sap sipper': ['Grass'],
			'volt absorb': ['Electric'],
			'lightning rod': ['Electric'],
			'storm drain': ['Water'],
			'dry skin': ['Water'],
			'motor drive': ['Electric'],
		};
		if (immunityMap[simpleName]) {
			ab.immuneTo = immunityMap[simpleName];
		}
		abilities[nameLower] = ab;
	}

	const items: Record<string, ItemEntry> = {};
	for (const key of Object.keys(itemsRaw)) {
		const entry = itemsRaw[key];
		if (!entry || !entry.name) continue;
		const nameLower = entry.name.toLowerCase();
		const item: ItemEntry = { name: entry.name };
		switch (nameLower) {
			case 'choice band': item.attackMult = 1.5; break;
			case 'choice specs': item.spAttackMult = 1.5; break;
			case 'choice scarf': item.speedMult = 1.5; break;
			case 'life orb': item.damageMult = 1.3; break;
			case 'expert belt': item.superEffectiveMult = 1.2; break;
			case 'muscle band': item.damageMult = 1.1; break;
			case 'wise glasses': item.damageMult = 1.1; break;
		}
		items[nameLower] = item;
	}

	DATA_CACHE.species = species;
	DATA_CACHE.moves = moves;
	DATA_CACHE.abilities = abilities;
	DATA_CACHE.items = items;
}

export function resolveSpecies(name: string): SpeciesEntry | undefined {
	if (!DATA_CACHE.species) return undefined;
	const attempts = new Set<string>();
	attempts.add(name.toLowerCase());
	attempts.add(toID(name));

	const formMatch = name.match(/^(.+?)\s*\((.+)\)$/);
	if (formMatch) {
		const base = formMatch[1].trim();
		const formRaw = formMatch[2].trim();
		const formId = toID(formRaw);
		attempts.add(base.toLowerCase());
		attempts.add(toID(base));
		attempts.add(`${base}-${formRaw}`.toLowerCase());
		attempts.add(toID(`${base}-${formRaw}`));
		const regionMap: Record<string, string> = {
			alolan: 'Alola',
			galarian: 'Galar',
			hisuian: 'Hisui',
			paldean: 'Paldea',
		};
		if (regionMap[formId]) {
			attempts.add(`${base}-${regionMap[formId]}`.toLowerCase());
			attempts.add(toID(`${base}-${regionMap[formId]}`));
		}
		if (formId === 'midday') {
			attempts.add(base.toLowerCase());
			attempts.add(toID(base));
		}
	}

	for (const key of attempts) {
		if (DATA_CACHE.species[key]) {
			return DATA_CACHE.species[key];
		}
	}
	return undefined;
}
