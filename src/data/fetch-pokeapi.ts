export async function fetchPokeAPI(path: string): Promise<any> {
	const url = `https://pokeapi.co/api/v2/${path}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch PokeAPI ${path}: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export async function fetchPokeAPISafe(path: string): Promise<any | null> {
	const url = `https://pokeapi.co/api/v2/${path}`;
	const res = await fetch(url);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Failed to fetch PokeAPI ${path}: ${res.status} ${res.statusText}`);
	return res.json();
}

export async function fetchPokemonEntry(speciesName: string): Promise<any | null> {
	const direct = await fetchPokeAPISafe(`pokemon/${speciesName}`);
	if (direct) return direct;
	const speciesData = await fetchPokeAPISafe(`pokemon-species/${speciesName}`);
	if (!speciesData) return null;
	const defaultVariety = (speciesData.varieties as any[] | undefined)?.find((v: any) => v.is_default === true);
	const defaultName: string | undefined = defaultVariety?.pokemon?.name;
	if (!defaultName || defaultName === speciesName) return null;
	const fallbackPokemon = await fetchPokeAPISafe(`pokemon/${defaultName}`);
	if (!fallbackPokemon) return null;
	return {
		...fallbackPokemon,
		resolved_name: fallbackPokemon.name,
		name: speciesName,
	};
}

export async function fetchPokeAPIGenerationSpeciesNames(gen?: number): Promise<string[]> {
	const generation = gen ?? 9;
	const genRaw = await fetchPokeAPI(`generation/${generation}`);
	return (genRaw?.pokemon_species || []).map((s: any) => s?.name).filter(Boolean);
}
