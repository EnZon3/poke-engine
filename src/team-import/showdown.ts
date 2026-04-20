import type { PokemonSet } from '../types.js';
import { applyShowdownSetLine, createInitialShowdownSetState } from './body.js';
import { itemFromShowdownHeader, speciesFromShowdownHeader } from './header.js';
import { splitLines, splitTeamBlocks } from './split.js';

function parseShowdownSet(block: string): PokemonSet | null {
	const lines = splitLines(block)
		.map(line => line.trim())
		.filter(Boolean);
	if (lines.length === 0) return null;

	const header = lines[0];
	const species = speciesFromShowdownHeader(header);
	if (!species) return null;

	const state = createInitialShowdownSetState(itemFromShowdownHeader(header));
	for (const line of lines.slice(1)) {
		applyShowdownSetLine(state, line);
	}

	return {
		species,
		level: state.level,
		nature: state.nature,
		ability: state.ability,
		item: state.item,
		teraType: state.teraType,
		dynamax: state.dynamax,
		ivs: state.ivs,
		evs: state.evs,
		moves: state.moves.slice(0, 4),
	};
}

export function parseShowdownTeam(text: string): PokemonSet[] {
	const blocks = splitTeamBlocks(text)
		.map(block => block.trim())
		.filter(Boolean);

	const team = blocks
		.map(parseShowdownSet)
		.filter((set): set is PokemonSet => Boolean(set));

	if (team.length === 0) {
		throw new Error('Unable to parse Showdown team text.');
	}
	return team;
}
