import type { MoveEntry } from '../types.js';

export type ConfidenceLevel = 'Low' | 'Medium' | 'High';

export interface DamageProfile {
	min: number;
	max: number;
	expected: number;
	hitChance: number;
	oneHkoChance: number;
	twoHkoChance: number;
	distribution: Array<{ damage: number; prob: number }>;
}

export type DoublesAction = {
	move?: MoveEntry;
	target: 'slot1' | 'slot2' | 'both' | 'support';
	expectedDamage: number;
	expectedFraction: number;
	supportValue: number;
	primaryProfile?: DamageProfile;
	secondaryProfile?: DamageProfile;
	notes: string[];
};
