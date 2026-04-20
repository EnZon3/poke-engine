import type { AbilityEntry } from '../types.js';

const IMMUNITY_MAP: Record<string, string[]> = {
	levitate: ['Ground'],
	'flash fire': ['Fire'],
	'water absorb': ['Water'],
	'sap sipper': ['Grass'],
	'volt absorb': ['Electric'],
	'lightning rod': ['Electric'],
	'storm drain': ['Water'],
	'dry skin': ['Water'],
	'motor drive': ['Electric'],
};

export function normalizeAbilities(abilitiesRaw: Record<string, any>): Record<string, AbilityEntry> {
	const abilities: Record<string, AbilityEntry> = {};
	for (const key of Object.keys(abilitiesRaw)) {
		const entry = abilitiesRaw[key];
		if (!entry || !entry.name) continue;
		const nameLower = entry.name.toLowerCase();
		const ability: AbilityEntry = { name: entry.name };
		if (nameLower === 'huge power' || nameLower === 'pure power') ability.doubleAttack = true;
		if (nameLower === 'technician') ability.technician = true;
		if (nameLower === 'adaptability') ability.adaptability = true;
		if (IMMUNITY_MAP[nameLower]) {
			ability.immuneTo = IMMUNITY_MAP[nameLower];
		}
		abilities[nameLower] = ability;
	}
	return abilities;
}
