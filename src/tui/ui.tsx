import React, { useMemo, useState } from 'react';
import { useApp, useInput } from 'ink';
import { loadData } from '../data.js';
import { applyEstimatedSpread } from '../estimation.js';
import { evaluateTeams } from '../evaluation/index.js';
import type { TuiDefaults } from '../interactive.js';
import { loadTeamFromSaveFile } from '../save-import.js';
import { fetchTrainerTeamFromSource } from '../trainers.js';
import type { CliResult, EvaluationOptions, PokemonSet } from '../types.js';
import { parseGeneration } from '../utils.js';
import { EDITOR_FIELDS, createDefaultPokemonSet, type SetupState } from './model.js';
import { buildSetupQuestions } from './setup.js';
import { getFieldValue, teamFromDefaults, updateFieldValue } from './utils.js';
import { EditorView, HelpView, ResultsView, SetupView } from './views.js';

export function InkTuiApp({ defaults }: { defaults: TuiDefaults }): React.JSX.Element {
	const { exit } = useApp();
	const [phase, setPhase] = useState<'setup' | 'editor' | 'results'>('setup');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [statusMsg, setStatusMsg] = useState('');
	const [results, setResults] = useState<CliResult | null>(null);
	const [showHelpFullscreen, setShowHelpFullscreen] = useState(false);

	const [setup, setSetup] = useState<SetupState>({
		genInput: defaults.gen ? String(defaults.gen) : '',
		battleFormat: defaults.evaluationOptions?.battleFormat ?? 'singles',
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
		battleState: { weather: 'none', terrain: 'none', mySide: {}, enemySide: {} },
		lookaheadTurns: 2,
		allowSwitching: false,
		roleWeight: 0.12,
		defensiveWeight: 0.22,
		opponentRiskWeight: 0.5,
		...defaults.evaluationOptions,
		battleFormat: setup.battleFormat,
		mode: setup.mode,
	};

	const setupQuestions = useMemo(() => buildSetupQuestions(setup, setSetup), [setup]);

	const activeQuestion = setupQuestions[Math.min(setupIndex, setupQuestions.length - 1)];
	const selectedPokemon = editingSide === 'my' ? selectedMyPokemon : selectedEnemyPokemon;
	const activeTeam = editingSide === 'my' ? myTeam : enemyTeam;
	const activePokemon = activeTeam[selectedPokemon] ?? createDefaultPokemonSet();

	const setFieldValue = (field: (typeof EDITOR_FIELDS)[number], value: string): void => {
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
				setMyTeam(JSON.parse(fs.readFileSync(setup.myFile, 'utf8')) as PokemonSet[]);
			} else if (setup.mySource === 'save') {
				setMyTeam(await loadTeamFromSaveFile(setup.mySaveFile));
			}
			if (setup.enemySource === 'json') {
				const fs = await import('node:fs');
				setEnemyTeam(JSON.parse(fs.readFileSync(setup.enemyFile, 'utf8')) as PokemonSet[]);
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

	useInput((input, key) => {
		if (busy) return;
		if (phase === 'setup') {
			if (key.escape || (key.ctrl && input === 'c')) {
				exit();
				return;
			}
			if (!activeQuestion) return;
			if (activeQuestion.kind === 'select' && activeQuestion.options && activeQuestion.options.length > 0) {
				const idx = Math.max(0, activeQuestion.options.findIndex(opt => opt.value === activeQuestion.value));
				if (key.upArrow) {
					const nextIdx = (idx - 1 + activeQuestion.options.length) % activeQuestion.options.length;
					activeQuestion.setValue(activeQuestion.options[nextIdx].value);
					return;
				}
				if (key.downArrow) {
					const nextIdx = (idx + 1) % activeQuestion.options.length;
					activeQuestion.setValue(activeQuestion.options[nextIdx].value);
					return;
				}
			}
			if (key.return) {
				const errorText = activeQuestion.validate?.(activeQuestion.value) ?? null;
				if (errorText) {
					setError(errorText);
					return;
				}
				setError(null);
				if (setupIndex >= setupQuestions.length - 1) {
					void finalizeSetup();
				} else {
					setSetupIndex((v: number) => v + 1);
				}
			}
			if (key.leftArrow && setupIndex > 0) setSetupIndex((v: number) => v - 1);
			return;
		}

		if (phase === 'editor') {
			if (savePrompt) {
				if (key.escape) {
					setSavePrompt(false);
					return;
				}
				if (key.return) {
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
				}
				return;
			}
			if (editMode) {
				if (key.escape) {
					setEditMode(false);
					return;
				}
				if (key.return) {
					setFieldValue(EDITOR_FIELDS[selectedField], editBuffer);
					setEditMode(false);
					setStatusMsg(`Updated ${EDITOR_FIELDS[selectedField]} for slot ${selectedPokemon + 1}.`);
				}
				return;
			}
			if ((key.ctrl && input === 'c') || input === 'q') {
				exit();
				return;
			}
			if (key.upArrow) {
				if (editingSide === 'my') setSelectedMyPokemon((v: number) => Math.max(0, v - 1));
				else setSelectedEnemyPokemon((v: number) => Math.max(0, v - 1));
			}
			if (key.downArrow) {
				const maxIndex = Math.max(0, activeTeam.length - 1);
				if (editingSide === 'my') setSelectedMyPokemon((v: number) => Math.min(maxIndex, v + 1));
				else setSelectedEnemyPokemon((v: number) => Math.min(maxIndex, v + 1));
			}
			if (key.leftArrow) setSelectedField((v: number) => Math.max(0, v - 1));
			if (key.rightArrow) setSelectedField((v: number) => Math.min(EDITOR_FIELDS.length - 1, v + 1));
			if (input === 'o') {
				setEditingSide((v) => (v === 'my' ? 'enemy' : 'my'));
				setStatusMsg(`Now editing ${editingSide === 'my' ? 'enemy' : 'your'} team.`);
			}
			if (input === 'e') {
				setEditBuffer(getFieldValue(EDITOR_FIELDS[selectedField], activePokemon));
				setEditMode(true);
			}
			if (input === 'a' && activeTeam.length < 6) {
				const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
				updateTeam((prev: PokemonSet[]) => [...prev, createDefaultPokemonSet()]);
				setStatusMsg(`Added a new ${editingSide === 'my' ? 'party' : 'enemy'} slot.`);
			}
			if (input === 'x' && activeTeam.length > 1) {
				const updateTeam = editingSide === 'my' ? setMyTeam : setEnemyTeam;
				updateTeam((prev: PokemonSet[]) => prev.filter((_: PokemonSet, i: number) => i !== selectedPokemon));
				if (editingSide === 'my') setSelectedMyPokemon((v: number) => Math.max(0, Math.min(v, activeTeam.length - 2)));
				else setSelectedEnemyPokemon((v: number) => Math.max(0, Math.min(v, activeTeam.length - 2)));
				setStatusMsg(`Removed selected ${editingSide === 'my' ? 'party' : 'enemy'} slot.`);
			}
			if (input === 'p') {
				estimateSelectedSpread();
			}
			if (input === 's') {
				setSavePath(editingSide === 'my' ? (defaults.myFile ?? 'my-team.json') : (defaults.enemyFile ?? 'enemy-team.json'));
				setSavePrompt(true);
			}
			if (input === 'c') {
				void calculate();
			}
			return;
		}

		if (phase === 'results') {
			if ((key.ctrl && input === 'c') || input === 'q') {
				exit();
				return;
			}
			if (input === 'h') {
				setShowHelpFullscreen(v => !v);
			}
			if (input === 'm') {
				setShowHelpFullscreen(false);
			}
			if (input === 'b') {
				setPhase('editor');
			}
			if (input === 'r') {
				void calculate();
			}
		}
	});

	if (phase === 'setup') {
		return (
			<SetupView
				setupIndex={setupIndex}
				setupQuestionsLength={setupQuestions.length}
				activeQuestion={activeQuestion}
				error={error}
				statusMsg={statusMsg}
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
				fields={EDITOR_FIELDS}
				activePokemon={activePokemon}
				editMode={editMode}
				editBuffer={editBuffer}
				setEditBuffer={setEditBuffer}
				savePrompt={savePrompt}
				savePath={savePath}
				setSavePath={setSavePath}
				statusMsg={statusMsg}
				error={error}
			/>
		);
	}

	if (showHelpFullscreen) return <HelpView />;
	return <ResultsView results={results} error={error} />;
}
