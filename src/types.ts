export interface Stats {
	hp: number;
	atk: number;
	def: number;
	spa: number;
	spd: number;
	spe: number;
}

export interface PokemonSet {
	species: string;
	level: number;
	nature: string;
	ability?: string;
	item?: string;
	teraType?: string;
	dynamax?: boolean;
	status?: 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz' | null;
	boosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
	ivs: Stats;
	evs: Stats;
	moves: string[];
}

export interface SpeciesEntry {
	name: string;
	types: string[];
	baseStats: Stats;
}

export interface MoveEntry {
	name: string;
	type: string;
	basePower: number;
	category: 'Physical' | 'Special' | 'Status';
	accuracy: number | true;
	priority?: number;
	recoil?: boolean;
	drain?: boolean;
	setupBoosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
}

export interface AbilityEntry {
	name: string;
	doubleAttack?: boolean;
	technician?: boolean;
	adaptability?: boolean;
	immuneTo?: string[];
}

export interface ItemEntry {
	name: string;
	attackMult?: number;
	spAttackMult?: number;
	speedMult?: number;
	damageMult?: number;
	superEffectiveMult?: number;
}

export interface BattlePokemon {
	species: SpeciesEntry;
	level: number;
	nature: string;
	stats: Stats;
	moves: MoveEntry[];
	ability?: string;
	item?: string;
	teraType?: string;
	dynamax?: boolean;
	status?: 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz' | null;
	boosts?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
}

export type TypeChart = {
	[attacker: string]: {
		immunes: string[];
		weaknesses: string[];
		strengths: string[];
	};
};

export interface SideState {
	reflect?: boolean;
	lightScreen?: boolean;
	stealthRock?: boolean;
	spikesLayers?: 0 | 1 | 2 | 3;
	stickyWeb?: boolean;
}

export interface BattleState {
	weather?: 'sun' | 'rain' | 'sand' | 'snow' | 'none';
	terrain?: 'electric' | 'grassy' | 'misty' | 'psychic' | 'none';
	mySide?: SideState;
	enemySide?: SideState;
}

export interface EvaluationOptions {
	battleState?: BattleState;
	battleFormat?: BattleFormat;
	lookaheadTurns?: 1 | 2 | 3;
	allowSwitching?: boolean;
	roleWeight?: number;
	defensiveWeight?: number;
	opponentRiskWeight?: number;
	mode?: 'casual' | 'competitive' | 'custom';
}

export interface MatchupEvaluation {
	pokemon: string;
	move?: string;
	score: number;
	minDamagePercent?: number;
	maxDamagePercent?: number;
	oneHkoChance?: number;
	twoHkoChance?: number;
	speedAdvantage?: boolean;
	role?: string;
	confidence?: 'Low' | 'Medium' | 'High';
	rationale?: string[];
	notes?: string[];
}

export type DataSource = 'showdown' | 'pokeapi';
export type TrainerSource = 'littleroot' | 'pokeapi';
export type BattleFormat = 'singles' | 'doubles';

export interface DataCache {
	species?: Record<string, SpeciesEntry>;
	moves?: Record<string, MoveEntry>;
	abilities?: Record<string, AbilityEntry>;
	items?: Record<string, ItemEntry>;
}

export type CliResult = Record<string, MatchupEvaluation[]>;
