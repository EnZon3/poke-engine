import type { ItemEntry } from '../types.js';

export function normalizeItems(itemsRaw: Record<string, any>): Record<string, ItemEntry> {
	const items: Record<string, ItemEntry> = {};
	for (const key of Object.keys(itemsRaw)) {
		const entry = itemsRaw[key];
		if (!entry || !entry.name) continue;
		const nameLower = entry.name.toLowerCase();
		const item: ItemEntry = { name: entry.name };
		switch (nameLower) {
			case 'choice band': item.attackMult = 1.5; break;
			case 'choice specs': item.spAttackMult = 1.5; break;
			case 'choice scarf': item.speedMult = 1.5; break;
			case 'life orb': item.damageMult = 1.3; break;
			case 'expert belt': item.superEffectiveMult = 1.2; break;
			case 'muscle band': item.damageMult = 1.1; break;
			case 'wise glasses': item.damageMult = 1.1; break;
		}
		items[nameLower] = item;
	}
	return items;
}
