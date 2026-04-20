import type { Stats } from '../types.js';
import { toID } from '../utils.js';

export const ZERO_STATS: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
export const PERFECT_IVS: Stats = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

function statKey(label: string): keyof Stats | undefined {
	switch (toID(label)) {
		case 'hp':
			return 'hp';
		case 'atk':
		case 'attack':
			return 'atk';
		case 'def':
		case 'defense':
			return 'def';
		case 'spa':
		case 'spatk':
		case 'specialattack':
		case 'satk':
			return 'spa';
		case 'spd':
		case 'spdef':
		case 'specialdefense':
		case 'sdef':
			return 'spd';
		case 'spe':
		case 'speed':
			return 'spe';
		default:
			return undefined;
	}
}

function firstWhitespaceIndex(value: string): number {
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) return i;
	}
	return -1;
}

function isAsciiAlpha(value: string): boolean {
	if (!value) return false;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if ((code < 65 || code > 90) && (code < 97 || code > 122)) return false;
	}
	return true;
}

function isDecimalInteger(value: string): boolean {
	if (!value) return false;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code < 48 || code > 57) return false;
	}
	return true;
}

function prefixedValue(line: string, prefix: string): string | undefined {
	if (!line.toLowerCase().startsWith(prefix.toLowerCase())) return undefined;
	const value = line.slice(prefix.length).trim();
	return value || undefined;
}

function parseSpread(line: string, base: Stats): Stats {
	const next = { ...base };
	for (const segment of line.split('/')) {
		const trimmed = segment.trim();
		if (!trimmed) continue;
		const spaceIndex = firstWhitespaceIndex(trimmed);
		if (spaceIndex <= 0) continue;
		const statValue = trimmed.slice(0, spaceIndex);
		const value = isDecimalInteger(statValue) ? Number.parseInt(statValue, 10) : Number.NaN;
		if (Number.isNaN(value)) continue;
		const key = statKey(trimmed.slice(spaceIndex).trim());
		if (!key) continue;
		next[key] = value;
	}
	return next;
}

export type ShowdownSetParseState = {
	level: number;
	nature: string;
	ability?: string;
	item?: string;
	teraType?: string;
	dynamax: boolean;
	evs: Stats;
	ivs: Stats;
	moves: string[];
};

export function createInitialShowdownSetState(initialItem?: string): ShowdownSetParseState {
	return {
		level: 50,
		nature: 'Serious',
		ability: undefined,
		item: initialItem,
		teraType: undefined,
		dynamax: false,
		evs: { ...ZERO_STATS },
		ivs: { ...PERFECT_IVS },
		moves: [],
	};
}

export function applyShowdownSetLine(state: ShowdownSetParseState, line: string): void {
	if (line.startsWith('-')) {
		let start = 0;
		while (line[start] === '-') start += 1;
		const move = line.slice(start).trim();
		if (move) state.moves.push(move);
		return;
	}
	const abilityValue = prefixedValue(line, 'Ability:');
	if (abilityValue) {
		state.ability = abilityValue;
		return;
	}
	const itemValue = prefixedValue(line, 'Item:');
	if (itemValue) {
		state.item = itemValue;
		return;
	}
	const levelValue = prefixedValue(line, 'Level:');
	if (levelValue) {
		const parsed = isDecimalInteger(levelValue) ? Number.parseInt(levelValue, 10) : Number.NaN;
		if (!Number.isNaN(parsed)) state.level = parsed;
		return;
	}
	const teraValue = prefixedValue(line, 'Tera Type:');
	if (teraValue) {
		state.teraType = teraValue;
		return;
	}
	const evValue = prefixedValue(line, 'EVs:');
	if (evValue) {
		state.evs = parseSpread(evValue, state.evs);
		return;
	}
	const ivValue = prefixedValue(line, 'IVs:');
	if (ivValue) {
		state.ivs = parseSpread(ivValue, state.ivs);
		return;
	}
	if (line.toLowerCase().endsWith(' nature')) {
		const natureValue = line.slice(0, -' Nature'.length).trim();
		if (isAsciiAlpha(natureValue)) state.nature = natureValue;
		return;
	}
	const dynamaxValue = prefixedValue(line, 'Dynamax:')?.toLowerCase();
	if (dynamaxValue === 'yes' || dynamaxValue === 'true' || dynamaxValue === '1') {
		state.dynamax = true;
	}
}
