import type { BattleFormat, BattleState, DataSource, TrainerSource } from './types.js';

export function toID(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

export function parseGeneration(input?: string): number | undefined {
	if (!input) return undefined;
	const raw = input.trim();
	if (!raw) return undefined;
	const numeric = parseInt(raw, 10);
	if (!isNaN(numeric) && numeric >= 1 && numeric <= 9) {
		return numeric;
	}
	const id = toID(raw);
	const aliases: Record<string, number> = {
		gen1: 1, rby: 1, redblueyellow: 1, kanto: 1,
		gen2: 2, gsc: 2, goldsilversilver: 2, goldsilvercrystal: 2, johto: 2,
		gen3: 3, rse: 3, frlg: 3, hoenn: 3,
		gen4: 4, dppt: 4, hgss: 4, sinnoh: 4,
		gen5: 5, bw: 5, b2w2: 5, unova: 5,
		gen6: 6, xy: 6, oras: 6, kalos: 6,
		gen7: 7, sm: 7, usum: 7, alola: 7,
		gen8: 8, swsh: 8, swordshield: 8, galar: 8,
		gen9: 9, sv: 9, scarletviolet: 9, paldea: 9,
	};
	return aliases[id];
}

export function parseDataSource(input?: string): DataSource | undefined {
	if (!input) return undefined;
	const id = toID(input);
	if (id === 'showdown' || id === 'pokemonshowdown') return 'showdown';
	if (id === 'pokeapi' || id === 'pokeapiv2') return 'pokeapi';
	return undefined;
}

export function parseTrainerSource(input?: string): TrainerSource | undefined {
	if (!input) return undefined;
	const id = toID(input);
	if (id === 'littleroot' || id === 'littlerootdreams') return 'littleroot';
	if (id === 'pokeapi' || id === 'pokeapiv2') return 'pokeapi';
	return undefined;
}

export function parseBattleFormat(input?: string): BattleFormat | undefined {
	if (!input) return undefined;
	const id = toID(input);
	if (id === 'singles' || id === 'single' || id === '1v1') return 'singles';
	if (id === 'doubles' || id === 'double' || id === '2v2' || id === 'vgc') return 'doubles';
	return undefined;
}

export function parseWeather(input?: string): BattleState['weather'] | undefined {
	if (!input) return undefined;
	const id = toID(input);
	if (id === 'sun' || id === 'sunnyday' || id === 'harsun') return 'sun';
	if (id === 'rain' || id === 'raindance') return 'rain';
	if (id === 'sand' || id === 'sandstorm') return 'sand';
	if (id === 'snow' || id === 'snowscape' || id === 'hail') return 'snow';
	if (id === 'none' || id === 'clear') return 'none';
	return undefined;
}

export function parseTerrain(input?: string): BattleState['terrain'] | undefined {
	if (!input) return undefined;
	const id = toID(input);
	if (id === 'electric' || id === 'electricterrain') return 'electric';
	if (id === 'grassy' || id === 'grassyterrain') return 'grassy';
	if (id === 'misty' || id === 'mistyterrain') return 'misty';
	if (id === 'psychic' || id === 'psychicterrain') return 'psychic';
	if (id === 'none' || id === 'clear') return 'none';
	return undefined;
}

export function parseAgainstTrainer(value: string): { game: string; trainerName: string } {
	const trimmed = value.trim();
	const separator = trimmed.includes(':') ? ':' : trimmed.includes('/') ? '/' : '';
	if (!separator) {
		throw new Error('Invalid --against-trainer format. Use --against-trainer=<game>:<trainer>');
	}
	const [gamePart, ...trainerParts] = trimmed.split(separator);
	const game = gamePart.trim();
	const trainerName = trainerParts.join(separator).trim();
	if (!game || !trainerName) {
		throw new Error('Invalid --against-trainer format. Use --against-trainer=<game>:<trainer>');
	}
	return { game, trainerName };
}
