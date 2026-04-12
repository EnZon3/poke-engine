import { parseGeneration } from '../utils.js';
import type { SetupQuestion, SetupState } from './model.js';

export function buildSetupQuestions(
	setup: SetupState,
	setSetup: (updater: (prev: SetupState) => SetupState) => void,
): SetupQuestion[] {
	const questions: SetupQuestion[] = [
		{
			id: 'gen',
			label: 'Generation (1-9, or alias; blank = latest)',
			kind: 'text',
			value: setup.genInput,
			setValue: v => setSetup((prev) => ({ ...prev, genInput: v })),
			validate: v => (v.trim() === '' || parseGeneration(v) ? null : 'Invalid generation input.'),
		},
		{
			id: 'battleFormat',
			label: 'Battle format',
			kind: 'select',
			value: setup.battleFormat,
			setValue: v => setSetup((prev) => ({ ...prev, battleFormat: v === 'doubles' ? 'doubles' : 'singles' })),
			options: [
				{ label: 'Singles (1v1 matchup matrix)', value: 'singles' },
				{ label: 'Doubles (2v2 lead matrix / VGC-style)', value: 'doubles' },
			],
		},
		{
			id: 'mode',
			label: 'Recommendation mode',
			kind: 'select',
			value: setup.mode,
			setValue: v => setSetup((prev) => ({ ...prev, mode: v === 'competitive' ? 'competitive' : (v === 'custom' ? 'custom' : 'casual') })),
			options: [
				{ label: 'Casual (clear + forgiving)', value: 'casual' },
				{ label: 'Competitive (deeper + risk-aware)', value: 'competitive' },
				{ label: 'Custom (manual flag tuning)', value: 'custom' },
			],
		},
		{
			id: 'dataSource',
			label: 'Data source',
			kind: 'select',
			value: setup.dataSource,
			setValue: v => setSetup((prev) => ({ ...prev, dataSource: v === 'pokeapi' ? 'pokeapi' : 'showdown' })),
			options: [
				{ label: 'Pokémon Showdown data', value: 'showdown' },
				{ label: 'PokeAPI generation species', value: 'pokeapi' },
			],
		},
		{
			id: 'mySource',
			label: 'Your team source',
			kind: 'select',
			value: setup.mySource,
			setValue: v => setSetup((prev) => ({ ...prev, mySource: v === 'json' ? 'json' : (v === 'save' ? 'save' : 'builder') })),
			options: [
				{ label: 'Build interactively (party builder)', value: 'builder' },
				{ label: 'Load from JSON file', value: 'json' },
				{ label: 'Load from save file (PKHeX)', value: 'save' },
			],
		},
	];

	if (setup.mySource === 'json') {
		questions.push({
			id: 'myFile',
			label: 'Path to your team JSON',
			kind: 'text',
			value: setup.myFile,
			setValue: v => setSetup((prev) => ({ ...prev, myFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a file path.'),
		});
	}

	if (setup.mySource === 'save') {
		questions.push({
			id: 'mySaveFile',
			label: 'Path to your save file (.sav/.dat)',
			kind: 'text',
			value: setup.mySaveFile,
			setValue: v => setSetup((prev) => ({ ...prev, mySaveFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a save-file path.'),
		});
	}

	questions.push({
		id: 'enemySource',
		label: 'Opponent source',
		kind: 'select',
		value: setup.enemySource,
		setValue: v => setSetup((prev) => ({ ...prev, enemySource: v === 'trainer' ? 'trainer' : (v === 'builder' ? 'builder' : 'json') })),
		options: [
			{ label: 'Load opponent from JSON file', value: 'json' },
			{ label: 'Use trainer roster', value: 'trainer' },
			{ label: 'Build opponent interactively', value: 'builder' },
		],
	});

	if (setup.enemySource === 'json') {
		questions.push({
			id: 'enemyFile',
			label: 'Path to opponent team JSON',
			kind: 'text',
			value: setup.enemyFile,
			setValue: v => setSetup((prev) => ({ ...prev, enemyFile: v })),
			validate: v => (v.trim() ? null : 'Please provide a file path.'),
		});
	}

	if (setup.enemySource === 'trainer') {
		questions.push(
			{
				id: 'trainerSource',
				label: 'Trainer source',
				kind: 'select',
				value: setup.trainerSource,
				setValue: v => setSetup((prev) => ({ ...prev, trainerSource: v === 'pokeapi' ? 'pokeapi' : 'littleroot' })),
				options: [
					{ label: 'Littleroot Dreams trainer rosters', value: 'littleroot' },
					{ label: 'PokeAPI fallback (uses Littleroot)', value: 'pokeapi' },
				],
			},
			{
				id: 'game',
				label: 'Game code (e.g. sv, swsh, xy)',
				kind: 'text',
				value: setup.game,
				setValue: v => setSetup((prev) => ({ ...prev, game: v })),
				validate: v => (v.trim() ? null : 'Please provide a game code.'),
			},
			{
				id: 'trainer',
				label: 'Trainer name',
				kind: 'text',
				value: setup.trainerName,
				setValue: v => setSetup((prev) => ({ ...prev, trainerName: v })),
				validate: v => (v.trim() ? null : 'Please provide a trainer name.'),
			},
		);
	}

	return questions;
}
