export async function fetchShowdownJSON(name: string): Promise<any> {
	const url = `https://play.pokemonshowdown.com/data/${name}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch ${name}: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

export async function fetchShowdownJSONWithFallback(primary: string, fallback: string): Promise<any> {
	try {
		return await fetchShowdownJSON(primary);
	} catch {
		return fetchShowdownJSON(fallback);
	}
}
