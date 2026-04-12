import type { DataSource, PokemonSet, TrainerSource } from '../types.js';

export type SetupState = {
	genInput: string;
	battleFormat: 'singles' | 'doubles';
	mode: 'casual' | 'competitive' | 'custom';
	dataSource: DataSource;
	mySource: 'json' | 'builder' | 'save';
	myFile: string;
	mySaveFile: string;
	enemySource: 'json' | 'trainer' | 'builder';
	enemyFile: string;
	trainerSource: TrainerSource;
	game: string;
	trainerName: string;
};

export type SetupQuestion = {
	id: string;
	label: string;
	kind: 'text' | 'select';
	value: string;
	setValue: (v: string) => void;
	validate?: (v: string) => string | null;
	options?: Array<{ label: string; value: string }>;
};

export const EDITOR_FIELDS = ['species', 'level', 'nature', 'ability', 'item', 'teraType', 'dynamax', 'status', 'ivs', 'evs', 'moves'] as const;
export type EditorField = typeof EDITOR_FIELDS[number];

export function createDefaultPokemonSet(): PokemonSet {
	return {
		species: 'Pikachu',
		level: 50,
		nature: 'Serious',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
		moves: ['Thunderbolt', 'Volt Tackle', 'Quick Attack', 'Protect'],
	};
}
