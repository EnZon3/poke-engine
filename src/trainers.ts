import type { PokemonSet, TrainerSource } from './types.js';
import { applyEstimatedSpreadsToTeam } from './estimation.js';
import { toID } from './utils.js';

function trainerAliases(value: string): string[] {
	const compact = toID(value);
	if (!compact) return [];
	const withoutDigits = compact.replace(/\d+/g, '');
	const withoutGameSuffix = withoutDigits.replace(/(rby|gsc|rse|frlg|dppt|hgss|bw2|bw|xy|oras|sm|usum|swsh|bdsp|sv|lgpe)$/g, '');
	const withoutVariantSuffix = withoutGameSuffix.replace(/(g|f|w|c)$/g, '');
	return Array.from(new Set([compact, withoutDigits, withoutGameSuffix, withoutVariantSuffix].filter(Boolean)));
}

function trainerGameCodeCandidates(game: string): string[] {
	const raw = game.trim().toLowerCase();
	const id = toID(raw);
	const aliasMap: Record<string, string[]> = {
		rby: ['rbg'],
		rgb: ['rbg'],
		gen1: ['rbg'],
		rse: ['rs'],
		hoenn: ['rs'],
		dppt: ['dp', 'pt'],
		bw2: ['b2w2'],
		b2w2: ['b2w2'],
	};
	const mapped = aliasMap[id] ?? [];
	return Array.from(new Set([raw, id, ...mapped].filter(Boolean)));
}

async function fetchTrainerScriptForGame(game: string): Promise<{ gameCode: string; text: string }> {
	const candidates = trainerGameCodeCandidates(game);
	for (const code of candidates) {
		const url = `https://www.littlerootdreams.com/js/${code}.js`;
		const res = await fetch(url);
		if (res.ok) return { gameCode: code, text: await res.text() };
	}
	throw new Error(
		`Failed to fetch trainer data for ${game}. Tried game codes: ${candidates.join(', ')}. ` +
		`Common codes include rbg, gsc, rs, frlg, dp, pt, hgss, bw, b2w2, xy, oras, sm, usum, swsh, sv.`,
	);
}

export async function fetchTrainerTeam(game: string, trainerName: string): Promise<PokemonSet[]> {
	const { gameCode, text } = await fetchTrainerScriptForGame(game);
	const varRegex = /let\s+([a-zA-Z0-9_]+)\s*=\s*document\.querySelector\s*\(\s*["']#([^"']+)["']\s*\)/gi;
	const trainerHandles: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = varRegex.exec(text))) {
		trainerHandles.push(m[2] || m[1]);
	}

	const arrRegex = /(?:let|const|var)\s+[a-zA-Z0-9_]+_trainers\s*=\s*(\[[\s\S]*?\])\s*;?/;
	const arrMatch = text.match(arrRegex);
	if (!arrMatch) throw new Error(`Could not locate trainer array in ${gameCode}.js`);

	let arrayStr = arrMatch[1];
	arrayStr = arrayStr.replace(/([,{]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
	arrayStr = arrayStr.replace(/\/\/.*$/gm, '');
	arrayStr = arrayStr.replace(/,\s*}/g, '}');
	arrayStr = arrayStr.replace(/,\s*]/g, ']');

	let trainers: any[];
	try {
		trainers = JSON.parse(arrayStr);
	} catch (err) {
		throw new Error(`Failed to parse trainer array for ${gameCode}: ${err}`);
	}

	const nameMap: Record<string, number> = {};
	trainerHandles.forEach((handle, idx) => {
		for (const alias of trainerAliases(handle)) {
			if (!(alias in nameMap)) nameMap[alias] = idx;
		}
	});

	const requestedAliases = trainerAliases(trainerName);
	let index: number | undefined;
	for (const key of requestedAliases) {
		if (nameMap[key] !== undefined) {
			index = nameMap[key];
			break;
		}
	}
	if (index === undefined) {
		for (const [k, idx] of Object.entries(nameMap)) {
			if (requestedAliases.some(alias => k.includes(alias) || alias.includes(k))) {
				index = idx;
				break;
			}
		}
	}
	if (index === undefined) throw new Error(`Trainer ${trainerName} not found in ${gameCode}`);

	const trainerObj = trainers[index];
	if (!trainerObj) throw new Error(`Trainer index ${index} missing in ${gameCode}`);

	const result: PokemonSet[] = [];
	const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
	for (const letter of letters) {
		const nameKey = `name${letter}`;
		const levelKey = `level${letter}`;
		if (!(nameKey in trainerObj)) continue;
		const speciesName: string = trainerObj[nameKey];
		if (!speciesName) continue;
		const levelRaw: string = trainerObj[levelKey] || '';
		const levelMatch = levelRaw.match(/(\d+)/);
		const level = levelMatch ? parseInt(levelMatch[1], 10) : 50;
		const ability = trainerObj[`ability${letter}`] ? String(trainerObj[`ability${letter}`]).replace(/Ability:\s*/i, '') : undefined;
		const item = trainerObj[`item${letter}`] ? String(trainerObj[`item${letter}`]).replace(/Item:\s*/i, '') : undefined;
		const moves: string[] = [];
		for (let i = 1; i <= 4; i++) {
			const mvKey = `move${i}${letter}`;
			if (trainerObj[mvKey]) {
				const mv = String(trainerObj[mvKey]).replace(/^-/, '').trim();
				if (mv) moves.push(mv);
			}
		}
		result.push({
			species: speciesName,
			level,
			nature: 'Serious',
			ability,
			item,
			ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			moves,
		});
	}
	return applyEstimatedSpreadsToTeam(result, false);
}

export async function fetchTrainerTeamFromSource(source: TrainerSource, game: string, trainerName: string): Promise<PokemonSet[]> {
	if (source === 'pokeapi') {
		console.warn('PokeAPI v2 does not expose trainer party rosters; falling back to Littleroot Dreams trainer data.');
	}
	return fetchTrainerTeam(game, trainerName);
}
