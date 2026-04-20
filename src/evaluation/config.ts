import type { EvaluationOptions } from '../types.js';

export type ModePreset = Required<Pick<EvaluationOptions, 'lookaheadTurns' | 'defensiveWeight' | 'opponentRiskWeight'>>;

export const MODE_PRESETS: Record<'casual' | 'competitive' | 'custom', ModePreset> = {
	casual: {
		lookaheadTurns: 2,
		defensiveWeight: 0.22,
		opponentRiskWeight: 0.5,
	},
	competitive: {
		lookaheadTurns: 3,
		defensiveWeight: 0.4,
		opponentRiskWeight: 0.65,
	},
	custom: {
		lookaheadTurns: 2,
		defensiveWeight: 0.3,
		opponentRiskWeight: 0.55,
	},
};

export const BASE_BATTLE_STATE: NonNullable<EvaluationOptions['battleState']> = {
	weather: 'none',
	terrain: 'none',
	mySide: {},
	enemySide: {},
};

export const CLI_DEFAULT_EVALUATION_OPTIONS: EvaluationOptions = {
	battleState: { ...BASE_BATTLE_STATE, mySide: {}, enemySide: {} },
	battleFormat: 'singles',
	mode: 'casual',
	lookaheadTurns: MODE_PRESETS.custom.lookaheadTurns,
	allowSwitching: false,
	roleWeight: 0.12,
	defensiveWeight: MODE_PRESETS.custom.defensiveWeight,
	opponentRiskWeight: MODE_PRESETS.custom.opponentRiskWeight,
};

export const TUI_DEFAULT_EVALUATION_OPTIONS: EvaluationOptions = {
	battleState: { ...BASE_BATTLE_STATE, mySide: {}, enemySide: {} },
	lookaheadTurns: MODE_PRESETS.casual.lookaheadTurns,
	allowSwitching: false,
	roleWeight: 0.12,
	defensiveWeight: MODE_PRESETS.casual.defensiveWeight,
	opponentRiskWeight: MODE_PRESETS.casual.opponentRiskWeight,
};

export function applyModePreset(options: EvaluationOptions, mode: 'casual' | 'competitive' | 'custom'): void {
	options.mode = mode;
	if (mode === 'custom') return;
	const preset = MODE_PRESETS[mode];
	options.lookaheadTurns = preset.lookaheadTurns;
	options.defensiveWeight = preset.defensiveWeight;
	options.opponentRiskWeight = preset.opponentRiskWeight;
}
