import { buildPokemon } from '../pokemon.js';
import type { BattlePokemon, EvaluationOptions, PokemonSet } from '../types.js';

export type PokemonVariant = {
	pokemon: BattlePokemon;
	tag: string;
};

export type PokemonPairVariant = {
	pair: [BattlePokemon, BattlePokemon];
	tag: string;
};

export function pairIndexCombinations(size: number): Array<[number, number]> {
	const pairs: Array<[number, number]> = [];
	for (let i = 0; i < size; i++) {
		for (let j = i + 1; j < size; j++) {
			pairs.push([i, j]);
		}
	}
	if (pairs.length === 0 && size === 1) pairs.push([0, 0]);
	return pairs;
}

function sameVariant(a: BattlePokemon, b: BattlePokemon): boolean {
	return a.species.name === b.species.name
		&& a.ability === b.ability
		&& a.teraType === b.teraType
		&& !!a.dynamax === !!b.dynamax
		&& a.stats.hp === b.stats.hp;
}

function activeVariantTag(base: BattlePokemon, active: BattlePokemon): string {
	const tags: string[] = [];
	if (active.species.name !== base.species.name && active.megaForm) tags.push(active.megaForm);
	if (!base.dynamax && active.dynamax) tags.push('Dynamax');
	if (!base.teraType && active.teraType) tags.push(`Tera ${active.teraType}`);
	if (base.teraType && active.teraType && base.teraType !== active.teraType) tags.push(`Tera ${active.teraType}`);
	return tags.join(' + ') || 'gimmick active';
}

export function buildVariants(set: PokemonSet, options: EvaluationOptions): PokemonVariant[] {
	const disableBattleGimmicks = options.mechanicsPolicy === 'disable-all';
	if (options.gimmickControl !== 'auto') {
		return [{ pokemon: buildPokemon(set, { disableBattleGimmicks }), tag: 'manual' }];
	}
	const base = buildPokemon(set, { disableBattleGimmicks, forceGimmicksInactive: true });
	const active = buildPokemon(set, { disableBattleGimmicks });
	if (sameVariant(base, active)) {
		return [{ pokemon: base, tag: 'base' }];
	}
	return [
		{ pokemon: base, tag: 'base' },
		{ pokemon: active, tag: activeVariantTag(base, active) },
	];
}

export function buildPairVariants(
	slotA: PokemonVariant[],
	slotB: PokemonVariant[],
): PokemonPairVariant[] {
	const variants: PokemonPairVariant[] = [];
	for (const va of slotA) {
		for (const vb of slotB) {
			variants.push({
				pair: [va.pokemon, vb.pokemon],
				tag: [va.tag, vb.tag].filter((t) => t !== 'base').join(' + '),
			});
		}
	}
	return variants;
}
