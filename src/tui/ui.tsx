import React, { useMemo, useState } from 'react';
import { useApp, useInput, useWindowSize } from 'ink';
import { loadData } from '../data.js';
import { applyEstimatedSpread } from '../estimation.js';
import { evaluateTeams } from '../evaluation/index.js';
import type { TuiDefaults } from '../interactive.js';
import { loadTeamFromSaveFile } from '../save-import.js';
import { parseTeamInput } from '../team-import.js';
import { fetchTrainerTeamFromSource } from '../trainers.js';
import type { CliResult, EvaluationOptions, PokemonSet } from '../types.js';
import { parseGeneration } from '../utils.js';
import { TUI_DEFAULT_EVALUATION_OPTIONS } from '../evaluation/config.js';
import { createDefaultPokemonSet, getEditorFieldsForGeneration, type EditorField, type SetupState } from './model.js';
import { buildSetupQuestions } from './setup.js';
import { teamFromDefaults, updateFieldValue } from './utils.js';
import { handleTuiInput } from './state-machine.js';
import { EditorView, HelpView, ResultsView, SetupView } from './views.js';

export function InkTuiApp({ defaults }: { defaults: TuiDefaults }): React.JSX.Element {
	const { exit } = useApp();
	const { columns, rows } = useWindowSize();
	const [phase, setPhase] = useState<'setup' | 'editor' | 'results'>('setup');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [statusMsg, setStatusMsg] = useState('');
	const [results, setResults] = useState<CliResult | null>(null);
	const [showHelpFullscreen, setShowHelpFullscreen] = useState(false);
	const [selectedResultIndex, setSelectedResultIndex] = useState(0);
	const [expandedEnemyKey, setExpandedEnemyKey] = useState<string | null>(null);

	const [setup, setSetup] = useState<SetupState>({
		genInput: defaults.gen ? String(defaults.gen) : '',
		battleFormat: defaults.evaluationOptions?.battleFormat ?? 'singles',
		mechanicsPolicy: defaults.evaluationOptions?.mechanicsPolicy ?? 'generation-default',
		gimmickControl: defaults.evaluationOptions?.gimmickControl ?? 'manual',
		mode: defaults.evaluationOptions?.mode ?? 'casual',
		dataSource: defaults.dataSource ?? 'showdown',
		mySource: defaults.mySaveFile ? 'save' : (defaults.myFile ? 'json' : 'builder'),
		myFile: defaults.myFile ?? 'my-team.json',
		mySaveFile: defaults.mySaveFile ?? 'main.sav',
		enemySource: defaults.enemyFile
			? 'json'
			: ((defaults.game && defaults.trainerName) ? 'trainer' : 'builder'),
		enemyFile: defaults.enemyFile ?? 'enemy-team.json',
		trainerSource: defaults.trainerSource ?? 'littleroot',
		game: defaults.game ?? 'sv',
		trainerName: defaults.trainerName ?? 'nemona',
	});

	const [setupIndex, setSetupIndex] = useState(0);
	const [myTeam, setMyTeam] = useState<PokemonSet[]>(teamFromDefaults(defaults.myFile));
	const [enemyTeam, setEnemyTeam] = useState<PokemonSet[]>([]);
	const [editingSide, setEditingSide] = useState<'my' | 'enemy'>('my');
	const [selectedMyPokemon, setSelectedMyPokemon] = useState(0);
	const [selectedEnemyPokemon, setSelectedEnemyPokemon] = useState(0);
	const [selectedField, setSelectedField] = useState(0);
	const [editMode, setEditMode] = useState(false);
	const [editBuffer, setEditBuffer] = useState('');
	const [savePrompt, setSavePrompt] = useState(false);
	const [savePath, setSavePath] = useState(defaults.myFile ?? 'my-team.json');

	const evaluationOptions: EvaluationOptions = {
		...TUI_DEFAULT_EVALUATION_OPTIONS,
		battleState: {
			weather: TUI_DEFAULT_EVALUATION_OPTIONS.battleState?.weather ?? 'none',
			terrain: TUI_DEFAULT_EVALUATION_OPTIONS.battleState?.terrain ?? 'none',
			mySide: { ...(TUI_DEFAULT_EVALUATION_OPTIONS.battleState?.mySide ?? {}) },
			enemySide: { ...(TUI_DEFAULT_EVALUATION_OPTIONS.battleState?.enemySide ?? {}) },
		},
		...defaults.evaluationOptions,
		battleFormat: setup.battleFormat,
		mechanicsPolicy: setup.mechanicsPolicy,
		gimmickControl: setup.gimmickControl,
		mode: setup.mode,
	};

	const setupQuestions = useMemo(() => buildSetupQuestions(setup, setSetup), [setup]);
	const resultEnemyKeys = useMemo(() => Object.keys(results ?? {}), [results]);
	const editorGeneration = parseGeneration(setup.genInput) ?? 9;
	const editorFields = useMemo(
		() => getEditorFieldsForGeneration(editorGeneration, setup.mechanicsPolicy),
		[editorGeneration, setup.mechanicsPolicy],
	);

	const activeQuestion = setupQuestions[Math.min(setupIndex, setupQuestions.length - 1)];
	const selectedPokemon = editingSide === 'my' ? selectedMyPokemon : selectedEnemyPokemon;
	const activeTeam = editingSide === 'my' ? myTeam : enemyTeam;
	const activePokemon = activeTeam[selectedPokemon] ?? createDefaultPokemonSet();

	const setFieldValue = (field: EditorField, value: string): void => {
		const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
		updateTeam((prev) => {
			const next = [...prev];
			const current = next[selectedPokemon] ?? createDefaultPokemonSet();
			next[selectedPokemon] = updateFieldValue(current, field, value);
			return next;
		});
	};

	const estimateSelectedSpread = (): void => {
		const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
		updateTeam((prev: PokemonSet[]) => {
			const next = [...prev];
			next[selectedPokemon] = applyEstimatedSpread(next[selectedPokemon] ?? createDefaultPokemonSet(), true);
			return next;
		});
		setStatusMsg(`Estimated IVs/EVs for ${editingSide === 'my' ? 'your' : 'enemy'} slot ${selectedPokemon + 1}.`);
	};

	const calculate = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		setStatusMsg('Calculating matchup matrix...');
		try {
			const r = evaluateTeams(myTeam, enemyTeam, evaluationOptions);
			setResults(r);
			setSelectedResultIndex(0);
			setExpandedEnemyKey(null);
			setPhase('results');
			setStatusMsg('Calculation complete.');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	const finalizeSetup = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		setStatusMsg('Loading data and preparing teams...');
		try {
			const gen = setup.genInput.trim() ? parseGeneration(setup.genInput) : undefined;
			if (setup.genInput.trim() && !gen) throw new Error('Invalid generation value.');
			await loadData(gen, setup.dataSource);
			if (setup.mySource === 'json') {
				const fs = await import('node:fs');
				setMyTeam(parseTeamInput(fs.readFileSync(setup.myFile, 'utf8')));
			} else if (setup.mySource === 'save') {
				setMyTeam(await loadTeamFromSaveFile(setup.mySaveFile));
			}
			if (setup.enemySource === 'json') {
				const fs = await import('node:fs');
				setEnemyTeam(parseTeamInput(fs.readFileSync(setup.enemyFile, 'utf8')));
			} else if (setup.enemySource === 'trainer') {
				const team = await fetchTrainerTeamFromSource(setup.trainerSource, setup.game, setup.trainerName);
				setEnemyTeam(team);
			} else {
				setEnemyTeam([createDefaultPokemonSet()]);
			}
			setPhase('editor');
			setStatusMsg('Ready. Edit your party and compute matchups.');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	const addSlot = (): void => {
		const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
		updateTeam((prev: PokemonSet[]) => [...prev, createDefaultPokemonSet()]);
	};

	const removeSelectedSlot = (): void => {
		const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
		updateTeam((prev: PokemonSet[]) => prev.filter((_: PokemonSet, i: number) => i !== selectedPokemon));
		if (editingSide === 'my') setSelectedMyPokemon((v: number) => Math.max(0, Math.min(v, activeTeam.length - 2)));
		else setSelectedEnemyPokemon((v: number) => Math.max(0, Math.min(v, activeTeam.length - 2)));
	};

	const commitSave = (): void => {
		void (async () => {
			try {
				const fs = await import('node:fs');
				const teamToSave = editingSide === 'my' ? myTeam : enemyTeam;
				fs.writeFileSync(savePath, JSON.stringify(teamToSave, null, 2));
				setStatusMsg(`Saved ${editingSide === 'my' ? 'your' : 'enemy'} team to ${savePath}`);
				setSavePrompt(false);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	};

	useInput((input, key) => {
		handleTuiInput(input, key, {
			phase,
			busy,
			setup: {
				setupIndex,
				setupQuestionsLength: setupQuestions.length,
				activeQuestion,
				setSetupIndex,
				setError,
				finalizeSetup: () => { void finalizeSetup(); },
				exit,
			},
			editor: {
				savePrompt,
				setSavePrompt,
				editMode,
				setEditMode,
				editorFields,
				selectedField,
				setSelectedField,
				selectedPokemon,
				activePokemon,
				activeTeam,
				editingSide,
				setEditingSide,
				setSelectedMyPokemon,
				setSelectedEnemyPokemon,
				setEditBuffer,
				setSavePath,
				defaultMyFile: defaults.myFile,
				defaultEnemyFile: defaults.enemyFile,
				setStatusMsg,
				setError,
				estimateSelectedSpread,
				calculate: () => { void calculate(); },
				setFieldValue,
				addSlot,
				removeSelectedSlot,
				commitSave,
				exit,
				editBuffer,
			},
			results: {
				resultEnemyKeys,
				selectedResultIndex,
				setSelectedResultIndex,
				expandedEnemyKey,
				setExpandedEnemyKey,
				setShowHelpFullscreen,
				setPhaseEditor: () => setPhase('editor'),
				calculate: () => { void calculate(); },
				exit,
			},
		});
	});

	if (phase === 'setup') {
		return (
			<SetupView
				setupIndex={setupIndex}
				setupQuestionsLength={setupQuestions.length}
				activeQuestion={activeQuestion}
				error={error}
				statusMsg={statusMsg}
				terminalColumns={columns}
				terminalRows={rows}
			/>
		);
	}

	if (phase === 'editor') {
		return (
			<EditorView
				editingSide={editingSide}
				myTeam={myTeam}
				enemyTeam={enemyTeam}
				selectedMyPokemon={selectedMyPokemon}
				selectedEnemyPokemon={selectedEnemyPokemon}
				selectedPokemon={selectedPokemon}
				selectedField={selectedField}
				fields={editorFields}
				activePokemon={activePokemon}
				editMode={editMode}
				editBuffer={editBuffer}
				setEditBuffer={setEditBuffer}
				savePrompt={savePrompt}
				savePath={savePath}
				setSavePath={setSavePath}
				statusMsg={statusMsg}
				error={error}
				terminalColumns={columns}
				terminalRows={rows}
			/>
		);
	}

	if (showHelpFullscreen) return <HelpView />;
	return (
		<ResultsView
			results={results}
			error={error}
			selectedIndex={Math.max(0, Math.min(selectedResultIndex, Math.max(0, resultEnemyKeys.length - 1)))}
			expandedEnemyKey={expandedEnemyKey}
			terminalColumns={columns}
			terminalRows={rows}
		/>
	);
}
