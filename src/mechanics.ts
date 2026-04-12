import { NATURE_MAP, TYPE_CHART } from './constants.js';
import type { Stats } from './types.js';

export function natureModifier(nature: string, stat: keyof Stats): number {
	const pair = NATURE_MAP[nature];
	if (!pair) return 1.0;
	const [increase, decrease] = pair;
	if (stat === increase && stat === decrease) return 1.0;
	if (stat === increase) return 1.1;
	if (stat === decrease) return 0.9;
	return 1.0;
}

export function typeEffectivenessSingle(attacking: string, defending: string): number {
	const entry = TYPE_CHART[attacking];
	if (!entry) return 1.0;
	if (entry.immunes.includes(defending)) return 0.0;
	if (entry.strengths.includes(defending)) return 2.0;
	if (entry.weaknesses.includes(defending)) return 0.5;
	return 1.0;
}

export function typeEffectiveness(attacking: string, defending: string[]): number {
	let multiplier = 1.0;
	for (const def of defending) {
		multiplier *= typeEffectivenessSingle(attacking, def);
	}
	return multiplier;
}
