import { readFileSync } from 'node:fs';
import type { PokemonSet, Stats } from '../types.js';
import { createDefaultPokemonSet, type EditorField } from './model.js';

export function teamFromDefaults(filePath?: string): PokemonSet[] {
	if (!filePath) return [createDefaultPokemonSet()];
	try {
		const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as PokemonSet[];
		if (Array.isArray(parsed) && parsed.length > 0) return parsed;
	} catch {
		// ignore and fallback
	}
	return [createDefaultPokemonSet()];
}

export function formatPercent(v?: number): string {
	if (v === undefined) return '-';
	return `${(v * 100).toFixed(1)}%`;
}

export function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export function renderBar(value01: number, width = 18): string {
	const v = clamp01(value01);
	const filled = Math.round(v * width);
	return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

export function renderPercentBar(percent: number, width = 12): string {
	return renderBar(percent / 100, width);
}

export function scoreColor(score: number): 'green' | 'yellow' | 'red' {
	if (score >= 0.25) return 'green';
	if (score <= -0.25) return 'red';
	return 'yellow';
}

export function truncateText(value: string, maxLen: number): string {
	if (value.length <= maxLen) return value;
	if (maxLen <= 1) return '…';
	return `${value.slice(0, maxLen - 1)}…`;
}

export function wrapText(value: string, maxLen: number): string[] {
	if (!value) return [''];
	const words = value.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [''];
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		if (!current) {
			current = word;
			continue;
		}
		if ((current.length + 1 + word.length) <= maxLen) {
			current += ` ${word}`;
		} else {
			lines.push(current);
			current = word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

export function statsToCsv(stats: Stats): string {
	return `${stats.hp}, ${stats.atk}, ${stats.def}, ${stats.spa}, ${stats.spd}, ${stats.spe}`;
}

export function parseStatsCsv(value: string): Stats | null {
	const raw = value.split(',').map(v => v.trim()).filter(Boolean);
	if (raw.length !== 6) return null;
	const parsed = raw.map(v => Number(v));
	if (parsed.some(v => Number.isNaN(v) || v < 0)) return null;
	return {
		hp: Math.floor(parsed[0]),
		atk: Math.floor(parsed[1]),
		def: Math.floor(parsed[2]),
		spa: Math.floor(parsed[3]),
		spd: Math.floor(parsed[4]),
		spe: Math.floor(parsed[5]),
	};
}

export function getFieldValue(field: EditorField, mon: PokemonSet): string {
	switch (field) {
		case 'species': return mon.species;
		case 'level': return String(mon.level);
		case 'nature': return mon.nature;
		case 'ability': return mon.ability ?? '';
		case 'item': return mon.item ?? '';
		case 'teraType': return mon.teraType ?? '';
		case 'dynamax': return mon.dynamax ? 'true' : 'false';
		case 'status': return mon.status ?? '';
		case 'ivs': return statsToCsv(mon.ivs);
		case 'evs': return statsToCsv(mon.evs);
		case 'moves': return mon.moves.join(', ');
	}
}

export function updateFieldValue(mon: PokemonSet, field: EditorField, value: string): PokemonSet {
	const target = { ...mon };
	switch (field) {
		case 'species': target.species = value.trim() || 'Pikachu'; break;
		case 'level': {
			const v = parseInt(value, 10);
			target.level = Number.isNaN(v) ? target.level : Math.max(1, Math.min(100, v));
			break;
		}
		case 'nature': target.nature = value.trim() || 'Serious'; break;
		case 'ability': target.ability = value.trim() || undefined; break;
		case 'item': target.item = value.trim() || undefined; break;
		case 'teraType': target.teraType = value.trim() || undefined; break;
		case 'dynamax': target.dynamax = ['true', 'yes', 'y', '1'].includes(value.trim().toLowerCase()); break;
		case 'status': {
			const v = value.trim().toLowerCase();
			target.status = (v === '' ? null : (['brn', 'par', 'psn', 'tox', 'slp', 'frz'].includes(v) ? v : null)) as PokemonSet['status'];
			break;
		}
		case 'ivs': {
			const parsed = parseStatsCsv(value);
			if (parsed) {
				target.ivs = {
					hp: Math.max(0, Math.min(31, parsed.hp)),
					atk: Math.max(0, Math.min(31, parsed.atk)),
					def: Math.max(0, Math.min(31, parsed.def)),
					spa: Math.max(0, Math.min(31, parsed.spa)),
					spd: Math.max(0, Math.min(31, parsed.spd)),
					spe: Math.max(0, Math.min(31, parsed.spe)),
				};
			}
			break;
		}
		case 'evs': {
			const parsed = parseStatsCsv(value);
			if (parsed) {
				target.evs = {
					hp: Math.max(0, Math.min(252, parsed.hp)),
					atk: Math.max(0, Math.min(252, parsed.atk)),
					def: Math.max(0, Math.min(252, parsed.def)),
					spa: Math.max(0, Math.min(252, parsed.spa)),
					spd: Math.max(0, Math.min(252, parsed.spd)),
					spe: Math.max(0, Math.min(252, parsed.spe)),
				};
			}
			break;
		}
		case 'moves': target.moves = value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 4); break;
	}
	return target;
}
