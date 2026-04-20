import type { PokemonSet } from '../types.js';
import { parseShowdownTeam } from './showdown.js';

function isPokemonSetArray(value: unknown): value is PokemonSet[] {
	if (!Array.isArray(value)) return false;
	return value.every((entry) => {
		if (!entry || typeof entry !== 'object') return false;
		const set = entry as Partial<PokemonSet>;
		return typeof set.species === 'string' && Array.isArray(set.moves);
	});
}

export function parseTeamInput(text: string): PokemonSet[] {
	try {
		const parsed = JSON.parse(text) as unknown;
		if (isPokemonSetArray(parsed)) return parsed;
	} catch {
		// Fall through to Showdown parser.
	}
	return parseShowdownTeam(text);
}
