import type { Dispatch, SetStateAction } from 'react';
import { createDefaultPokemonSet, type EditorField, type SetupQuestion } from './model.js';
import { getFieldValue } from './utils.js';
import type { PokemonSet } from '../types.js';

type InputKey = {
	upArrow?: boolean;
	downArrow?: boolean;
	leftArrow?: boolean;
	rightArrow?: boolean;
	return?: boolean;
	escape?: boolean;
	ctrl?: boolean;
};

type SetupContext = {
	setupIndex: number;
	setupQuestionsLength: number;
	activeQuestion?: SetupQuestion;
	setSetupIndex: Dispatch<SetStateAction<number>>;
	setError: (value: string | null) => void;
	finalizeSetup: () => void;
	exit: () => void;
};

type EditorContext = {
	savePrompt: boolean;
	setSavePrompt: Dispatch<SetStateAction<boolean>>;
	editMode: boolean;
	setEditMode: Dispatch<SetStateAction<boolean>>;
	editorFields: readonly EditorField[];
	selectedField: number;
	setSelectedField: Dispatch<SetStateAction<number>>;
	selectedPokemon: number;
	activePokemon: PokemonSet;
	activeTeam: PokemonSet[];
	editingSide: 'my' | 'enemy';
	setEditingSide: Dispatch<SetStateAction<'my' | 'enemy'>>;
	setSelectedMyPokemon: Dispatch<SetStateAction<number>>;
	setSelectedEnemyPokemon: Dispatch<SetStateAction<number>>;
	setEditBuffer: Dispatch<SetStateAction<string>>;
	setSavePath: Dispatch<SetStateAction<string>>;
	defaultMyFile?: string;
	defaultEnemyFile?: string;
	setStatusMsg: (value: string) => void;
	setError: (value: string | null) => void;
	estimateSelectedSpread: () => void;
	calculate: () => void;
	setFieldValue: (field: EditorField, value: string) => void;
	addSlot: () => void;
	removeSelectedSlot: () => void;
	commitSave: () => void;
	exit: () => void;
	editBuffer: string;
};

type ResultsContext = {
	resultEnemyKeys: string[];
	selectedResultIndex: number;
	setSelectedResultIndex: Dispatch<SetStateAction<number>>;
	expandedEnemyKey: string | null;
	setExpandedEnemyKey: Dispatch<SetStateAction<string | null>>;
	setShowHelpFullscreen: Dispatch<SetStateAction<boolean>>;
	setPhaseEditor: () => void;
	calculate: () => void;
	exit: () => void;
};

type TuiInputContext = {
	phase: 'setup' | 'editor' | 'results';
	busy: boolean;
	setup: SetupContext;
	editor: EditorContext;
	results: ResultsContext;
};

function handleSetupInput(input: string, key: InputKey, ctx: SetupContext): boolean {
	if (key.escape || (key.ctrl && input === 'c')) {
		ctx.exit();
		return true;
	}
	if (!ctx.activeQuestion) return true;

	if (ctx.activeQuestion.kind === 'select' && ctx.activeQuestion.options && ctx.activeQuestion.options.length > 0) {
		const idx = Math.max(0, ctx.activeQuestion.options.findIndex(opt => opt.value === ctx.activeQuestion?.value));
		if (key.upArrow) {
			const nextIdx = (idx - 1 + ctx.activeQuestion.options.length) % ctx.activeQuestion.options.length;
			ctx.activeQuestion.setValue(ctx.activeQuestion.options[nextIdx].value);
			return true;
		}
		if (key.downArrow) {
			const nextIdx = (idx + 1) % ctx.activeQuestion.options.length;
			ctx.activeQuestion.setValue(ctx.activeQuestion.options[nextIdx].value);
			return true;
		}
	}
	if (key.return) {
		const errorText = ctx.activeQuestion.validate?.(ctx.activeQuestion.value) ?? null;
		if (errorText) {
			ctx.setError(errorText);
			return true;
		}
		ctx.setError(null);
		if (ctx.setupIndex >= ctx.setupQuestionsLength - 1) ctx.finalizeSetup();
		else ctx.setSetupIndex((v) => v + 1);
		return true;
	}
	if (key.leftArrow && ctx.setupIndex > 0) {
		ctx.setSetupIndex((v) => v - 1);
		return true;
	}
	return true;
}

function handleEditorInput(input: string, key: InputKey, ctx: EditorContext): boolean {
	if (ctx.savePrompt) {
		if (key.escape) {
			ctx.setSavePrompt(false);
			return true;
		}
		if (key.return) {
			ctx.commitSave();
			return true;
		}
		return true;
	}
	if (ctx.editMode) {
		if (key.escape) {
			ctx.setEditMode(false);
			return true;
		}
		if (key.return) {
			const field = ctx.editorFields[ctx.selectedField];
			if (!field) return true;
			ctx.setFieldValue(field, ctx.editBuffer);
			ctx.setEditMode(false);
			ctx.setStatusMsg(`Updated ${field} for slot ${ctx.selectedPokemon + 1}.`);
			return true;
		}
		return true;
	}
	if ((key.ctrl && input === 'c') || input === 'q') {
		ctx.exit();
		return true;
	}
	if (key.upArrow) {
		if (ctx.editingSide === 'my') ctx.setSelectedMyPokemon((v) => Math.max(0, v - 1));
		else ctx.setSelectedEnemyPokemon((v) => Math.max(0, v - 1));
		return true;
	}
	if (key.downArrow) {
		const maxIndex = Math.max(0, ctx.activeTeam.length - 1);
		if (ctx.editingSide === 'my') ctx.setSelectedMyPokemon((v) => Math.min(maxIndex, v + 1));
		else ctx.setSelectedEnemyPokemon((v) => Math.min(maxIndex, v + 1));
		return true;
	}
	if (key.leftArrow) {
		ctx.setSelectedField((v) => Math.max(0, v - 1));
		return true;
	}
	if (key.rightArrow) {
		ctx.setSelectedField((v) => Math.min(ctx.editorFields.length - 1, v + 1));
		return true;
	}
	if (input === 'o') {
		ctx.setEditingSide((v) => (v === 'my' ? 'enemy' : 'my'));
		ctx.setStatusMsg(`Now editing ${ctx.editingSide === 'my' ? 'enemy' : 'your'} team.`);
		return true;
	}
	if (input === 'e') {
		const field = ctx.editorFields[ctx.selectedField];
		if (!field) return true;
		ctx.setEditBuffer(getFieldValue(field, ctx.activePokemon ?? createDefaultPokemonSet()));
		ctx.setEditMode(true);
		return true;
	}
	if (input === 'a' && ctx.activeTeam.length < 6) {
		ctx.addSlot();
		ctx.setStatusMsg(`Added a new ${ctx.editingSide === 'my' ? 'party' : 'enemy'} slot.`);
		return true;
	}
	if (input === 'x' && ctx.activeTeam.length > 1) {
		ctx.removeSelectedSlot();
		ctx.setStatusMsg(`Removed selected ${ctx.editingSide === 'my' ? 'party' : 'enemy'} slot.`);
		return true;
	}
	if (input === 'p') {
		ctx.estimateSelectedSpread();
		return true;
	}
	if (input === 's') {
		ctx.setSavePath(ctx.editingSide === 'my' ? (ctx.defaultMyFile ?? 'my-team.json') : (ctx.defaultEnemyFile ?? 'enemy-team.json'));
		ctx.setSavePrompt(true);
		return true;
	}
	if (input === 'c') {
		ctx.calculate();
		return true;
	}
	return true;
}

function handleResultsInput(input: string, key: InputKey, ctx: ResultsContext): boolean {
	if ((key.ctrl && input === 'c') || input === 'q') {
		ctx.exit();
		return true;
	}
	if ((key.leftArrow || key.upArrow) && ctx.resultEnemyKeys.length > 0) {
		ctx.setSelectedResultIndex((v) => Math.max(0, v - 1));
		return true;
	}
	if ((key.rightArrow || key.downArrow) && ctx.resultEnemyKeys.length > 0) {
		ctx.setSelectedResultIndex((v) => Math.min(ctx.resultEnemyKeys.length - 1, v + 1));
		return true;
	}
	if ((key.return || input === 'e') && ctx.resultEnemyKeys.length > 0) {
		const selectedEnemy = ctx.resultEnemyKeys[Math.max(0, Math.min(ctx.selectedResultIndex, ctx.resultEnemyKeys.length - 1))];
		ctx.setExpandedEnemyKey((v) => (v === selectedEnemy ? null : selectedEnemy));
		return true;
	}
	if (input === 'h') {
		ctx.setShowHelpFullscreen(v => !v);
		return true;
	}
	if (input === 'm') {
		ctx.setShowHelpFullscreen(false);
		return true;
	}
	if (input === 'b') {
		ctx.setPhaseEditor();
		return true;
	}
	if (input === 'r') {
		ctx.calculate();
		return true;
	}
	return true;
}

export function handleTuiInput(input: string, key: InputKey, context: TuiInputContext): void {
	if (context.busy) return;
	if (context.phase === 'setup') {
		handleSetupInput(input, key, context.setup);
		return;
	}
	if (context.phase === 'editor') {
		handleEditorInput(input, key, context.editor);
		return;
	}
	handleResultsInput(input, key, context.results);
}
