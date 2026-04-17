import type { MoveEntry } from '../types.js';
import { toID } from '../utils.js';

export function normalizeMoves(movesRaw: Record<string, any>): Record<string, MoveEntry> {
	const moves: Record<string, MoveEntry> = {};
	for (const key of Object.keys(movesRaw)) {
		const entry = movesRaw[key];
		if (!entry || !entry.name) continue;
		const setupBoosts = (entry?.boosts ?? entry?.self?.boosts) as Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> | undefined;
		const move: MoveEntry = {
			name: entry.name,
			type: entry.type,
			basePower: entry.basePower || 0,
			maxMoveBasePower: typeof entry.maxMove?.basePower === 'number' ? entry.maxMove.basePower : undefined,
			category: entry.category,
			accuracy: entry.accuracy,
			willCrit: !!entry.willCrit,
			critRatio: typeof entry.critRatio === 'number' ? entry.critRatio : undefined,
			multiHit: typeof entry.multihit === 'number'
				? entry.multihit
				: (Array.isArray(entry.multihit)
					&& entry.multihit.length === 2
					&& typeof entry.multihit[0] === 'number'
					&& typeof entry.multihit[1] === 'number'
						? [entry.multihit[0], entry.multihit[1]]
						: undefined),
			multiAccuracy: !!entry.multiaccuracy,
			priority: typeof entry.priority === 'number' ? entry.priority : 0,
			recoil: !!entry.recoil,
			drain: !!entry.drain,
			setupBoosts,
		};
		moves[entry.name.toLowerCase()] = move;
		moves[toID(entry.name)] = move;
		moves[toID(key)] = move;
	}
	return moves;
}
