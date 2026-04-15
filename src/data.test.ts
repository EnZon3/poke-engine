import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { DATA_CACHE, loadData, setActiveGeneration } from './data.js';

function resetDataCache(): void {
	delete DATA_CACHE.species;
	delete DATA_CACHE.moves;
	delete DATA_CACHE.abilities;
	delete DATA_CACHE.items;
	setActiveGeneration(9);
}

function makeJsonResponse(body: unknown): Response {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => body,
	} as unknown as Response;
}

function makeNotFoundResponse(): Response {
	return {
		ok: false,
		status: 404,
		statusText: 'Not Found',
		json: async () => ({}),
	} as unknown as Response;
}

test('loadData with PokeAPI falls back to default form for form-only Pokémon (e.g. Deoxys-Normal)', async () => {
	resetDataCache();

	mock.method(globalThis, 'fetch', async (url: string) => {
		// PokeAPI: generation list
		if (url.includes('pokeapi.co/api/v2/generation/3')) {
			return makeJsonResponse({ pokemon_species: [{ name: 'bulbasaur' }, { name: 'deoxys' }] });
		}
		// PokeAPI: direct pokemon fetch — bulbasaur succeeds, deoxys 404s
		if (url.includes('pokeapi.co/api/v2/pokemon/bulbasaur')) {
			return makeJsonResponse({
				name: 'bulbasaur',
				types: [{ slot: 1, type: { name: 'grass' } }, { slot: 2, type: { name: 'poison' } }],
				stats: [
					{ stat: { name: 'hp' }, base_stat: 45 },
					{ stat: { name: 'attack' }, base_stat: 49 },
					{ stat: { name: 'defense' }, base_stat: 49 },
					{ stat: { name: 'special-attack' }, base_stat: 65 },
					{ stat: { name: 'special-defense' }, base_stat: 65 },
					{ stat: { name: 'speed' }, base_stat: 45 },
				],
			});
		}
		if (url === 'https://pokeapi.co/api/v2/pokemon/deoxys') {
			return makeNotFoundResponse();
		}
		// PokeAPI: species endpoint reveals deoxys-normal as the default variety
		if (url.includes('pokeapi.co/api/v2/pokemon-species/deoxys')) {
			return makeJsonResponse({
				varieties: [
					{ is_default: true, pokemon: { name: 'deoxys-normal' } },
					{ is_default: false, pokemon: { name: 'deoxys-attack' } },
					{ is_default: false, pokemon: { name: 'deoxys-defense' } },
					{ is_default: false, pokemon: { name: 'deoxys-speed' } },
				],
			});
		}
		// PokeAPI: fetch the resolved default form
		if (url.includes('pokeapi.co/api/v2/pokemon/deoxys-normal')) {
			return makeJsonResponse({
				name: 'deoxys-normal',
				types: [{ slot: 1, type: { name: 'psychic' } }],
				stats: [
					{ stat: { name: 'hp' }, base_stat: 50 },
					{ stat: { name: 'attack' }, base_stat: 150 },
					{ stat: { name: 'defense' }, base_stat: 50 },
					{ stat: { name: 'special-attack' }, base_stat: 150 },
					{ stat: { name: 'special-defense' }, base_stat: 50 },
					{ stat: { name: 'speed' }, base_stat: 150 },
				],
			});
		}
		// Showdown endpoints (moves, abilities, items) — return empty objects
		if (new URL(url).hostname === 'play.pokemonshowdown.com') {
			return makeJsonResponse({});
		}
		return makeNotFoundResponse();
	});

	try {
		await loadData(3, 'pokeapi');

		// Bulbasaur loaded normally
		assert.ok(DATA_CACHE.species?.['bulbasaur'], 'bulbasaur should be in species cache');
		assert.deepEqual(DATA_CACHE.species?.['bulbasaur']?.types, ['Grass', 'Poison']);
		assert.equal(DATA_CACHE.species?.['bulbasaur']?.baseStats.hp, 45);

		// Deoxys resolved to its default form (deoxys-normal)
		const deoxys = DATA_CACHE.species?.['deoxys-normal'];
		assert.ok(deoxys, 'deoxys-normal should be in species cache after form fallback');
		assert.deepEqual(deoxys?.types, ['Psychic']);
		assert.equal(deoxys?.baseStats.hp, 50);
		assert.equal(deoxys?.baseStats.atk, 150);
	} finally {
		mock.restoreAll();
		resetDataCache();
	}
});

test('loadData with PokeAPI skips Pokémon that have no resolvable form', async () => {
	resetDataCache();

	mock.method(globalThis, 'fetch', async (url: string) => {
		if (url.includes('pokeapi.co/api/v2/generation/3')) {
			return makeJsonResponse({ pokemon_species: [{ name: 'mystery-mon' }] });
		}
		// All pokemon endpoints 404
		if (url.includes('pokeapi.co/api/v2/pokemon/') || url.includes('pokeapi.co/api/v2/pokemon-species/')) {
			return makeNotFoundResponse();
		}
		if (new URL(url).hostname === 'play.pokemonshowdown.com') return makeJsonResponse({});
		return makeNotFoundResponse();
	});

	try {
		// Should not throw — unknown/unresolvable entries are silently skipped
		await loadData(3, 'pokeapi');
		assert.equal(Object.keys(DATA_CACHE.species ?? {}).length, 0, 'no species should be loaded for fully unresolvable entries');
	} finally {
		mock.restoreAll();
		resetDataCache();
	}
});
