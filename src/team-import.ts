import { readFileSync } from 'node:fs';
import type { PokemonSet } from './types.js';
import { parseTeamInput } from './team-import/input.js';

export { parseShowdownTeam } from './team-import/showdown.js';
export { parseTeamInput } from './team-import/input.js';

export function loadTeamInputFile(filePath: string): PokemonSet[] {
	return parseTeamInput(readFileSync(filePath, 'utf8'));
}
