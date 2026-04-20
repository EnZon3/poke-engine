import type { DataCache, DataSource, SpeciesEntry } from './types.js';
import { fetchPokeAPIGenerationSpeciesNames, fetchPokemonEntry } from './data/fetch-pokeapi.js';
import { fetchShowdownJSON, fetchShowdownJSONWithFallback } from './data/fetch-showdown.js';
import { normalizeAbilities } from './data/normalize-abilities.js';
import { normalizeItems } from './data/normalize-items.js';
import { normalizeMoves } from './data/normalize-moves.js';
import { addPokeAPISpeciesEntry, normalizeShowdownSpecies } from './data/normalize-species.js';
import { toID } from './utils.js';

export const DATA_CACHE: DataCache = {};
export let ACTIVE_GENERATION = 9;

export function setActiveGeneration(gen?: number): void {
	ACTIVE_GENERATION = gen ?? 9;
}

export function getDataCache(): DataCache {
	return DATA_CACHE;
}

export function setDataCache(cache: DataCache): void {
	DATA_CACHE.species = cache.species;
	DATA_CACHE.moves = cache.moves;
	DATA_CACHE.abilities = cache.abilities;
	DATA_CACHE.items = cache.items;
}

export function resetDataCache(): void {
	delete DATA_CACHE.species;
	delete DATA_CACHE.moves;
	delete DATA_CACHE.abilities;
	delete DATA_CACHE.items;
}

export function isDataLoaded(): boolean {
	return Boolean(DATA_CACHE.species && DATA_CACHE.moves && DATA_CACHE.abilities && DATA_CACHE.items);
}

async function fetchOptionalShowdownDataset(prefix: string, gen: number | undefined, fileName: string): Promise<any> {
	try {
		return gen
			? await fetchShowdownJSONWithFallback(`${prefix}${fileName}`, fileName)
			: await fetchShowdownJSON(fileName);
	} catch {
		return {};
	}
}

async function loadSpeciesFromPokeAPI(gen?: number): Promise<Record<string, SpeciesEntry>> {
	const generation = gen ?? 9;
	const speciesList = await fetchPokeAPIGenerationSpeciesNames(generation);
	if (speciesList.length === 0) {
		throw new Error(`PokeAPI returned no species for generation ${generation}.`);
	}

	const species: Record<string, SpeciesEntry> = {};
	const chunkSize = 25;
	for (let i = 0; i < speciesList.length; i += chunkSize) {
		const chunk = speciesList.slice(i, i + chunkSize);
		const pokemonEntries = await Promise.all(chunk.map(name => fetchPokemonEntry(name)));
		for (const pkmn of pokemonEntries) {
			addPokeAPISpeciesEntry(species, pkmn);
		}
	}

	return species;
}

export async function loadData(gen?: number, dataSource: DataSource = 'showdown'): Promise<void> {
	setActiveGeneration(gen);
	if (isDataLoaded()) {
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
			? (gen ? fetchShowdownJSONWithFallback(`${prefix}pokedex.json`, 'pokedex.json') : fetchShowdownJSON('pokedex.json'))
			: Promise.resolve({}),
		gen ? fetchShowdownJSONWithFallback(`${prefix}moves.json`, 'moves.json') : fetchShowdownJSON('moves.json'),
		fetchOptionalShowdownDataset(prefix, gen, 'abilities.json'),
		fetchOptionalShowdownDataset(prefix, gen, 'items.json'),
	]);

	if (dataSource === 'showdown') {
		normalizeShowdownSpecies(species, pokedexRaw);
	}

	const moves = normalizeMoves(movesRaw);
	const abilities = normalizeAbilities(abilitiesRaw);
	const items = normalizeItems(itemsRaw);

	setDataCache({
		species,
		moves,
		abilities,
		items,
	});
}

export function resolveSpecies(name: string): SpeciesEntry | undefined {
	if (!DATA_CACHE.species) return undefined;
	const attempts = new Set<string>();
	attempts.add(name.toLowerCase());
	attempts.add(toID(name));

	if (name.endsWith(')')) {
		const openIndex = name.lastIndexOf('(');
		const base = openIndex > 0 ? name.slice(0, openIndex).trim() : '';
		const formRaw = openIndex > 0 ? name.slice(openIndex + 1, -1).trim() : '';
		if (base && formRaw) {
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
	}

	for (const key of attempts) {
		if (DATA_CACHE.species[key]) {
			return DATA_CACHE.species[key];
		}
	}
	return undefined;
}
