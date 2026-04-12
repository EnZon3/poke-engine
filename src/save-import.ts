import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PokemonSet, Stats } from './types.js';

type ApiOk = { success: true; [key: string]: unknown };
type ApiErr = { error: string; code?: string };
type ApiResult = ApiOk | ApiErr;

type PartySummary = {
	slot: number;
	isEgg?: boolean;
};

type PokemonDetailLike = {
	speciesName?: string;
	level?: number;
	natureName?: string;
	abilityName?: string;
	heldItemName?: string;
	moveNames?: string[];
	ivs?: number[];
	evs?: number[];
	isEgg?: boolean;
};

function isApiSuccess(result: ApiResult): result is ApiOk {
	return (result as ApiOk).success === true;
}

function apiError(result: unknown): string {
	if (result && typeof result === 'object') {
		const rec = result as Record<string, unknown>;
		if (typeof rec.error === 'string') return rec.error;
		if (typeof rec.message === 'string') return rec.message;
		if (typeof rec.reason === 'string') return rec.reason;
		try {
			return JSON.stringify(result);
		} catch {
			return 'Unknown PKHeX error';
		}
	}
	return 'Unknown PKHeX error';
}

function extractPartySlots(result: unknown): number[] | null {
	if (Array.isArray(result)) {
		return result
			.map((entry, index) => {
				if (entry && typeof entry === 'object' && Number.isInteger((entry as PartySummary).slot)) {
					return (entry as PartySummary).slot;
				}
				return index;
			})
			.filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 6);
	}

	if (!result || typeof result !== 'object') return null;
	const rec = result as Record<string, unknown>;
	const arrays = [rec.party, rec.pokemon, rec.results, rec.data];
	for (const arr of arrays) {
		if (!Array.isArray(arr)) continue;
		return arr
			.map((entry, index) => {
				if (entry && typeof entry === 'object' && Number.isInteger((entry as PartySummary).slot)) {
					return (entry as PartySummary).slot;
				}
				return index;
			})
			.filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 6);
	}

	return null;
}

function extractPokemonDetail(result: unknown): PokemonDetailLike | null {
	if (!result || typeof result !== 'object') return null;
	const rec = result as Record<string, unknown>;

	if ('success' in rec) {
		if (rec.success !== true) return null;
		return rec as PokemonDetailLike;
	}

	if (typeof rec.speciesName === 'string' || Array.isArray(rec.moveNames)) {
		return rec as PokemonDetailLike;
	}

	return null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeText(value?: string): string {
	return (value ?? '').trim();
}

function normalizeOptionalName(value?: string): string | undefined {
	const text = normalizeText(value);
	if (!text) return undefined;
	const id = text.toLowerCase();
	if (id === 'none' || id === '(none)') return undefined;
	return text;
}

function arrayToStats(values: number[] | undefined, fallback: number, maxValue: number): Stats {
	const arr = Array.isArray(values) ? values : [];
	return {
		hp: clamp(Math.floor(arr[0] ?? fallback), 0, maxValue),
		atk: clamp(Math.floor(arr[1] ?? fallback), 0, maxValue),
		def: clamp(Math.floor(arr[2] ?? fallback), 0, maxValue),
		spa: clamp(Math.floor(arr[3] ?? fallback), 0, maxValue),
		spd: clamp(Math.floor(arr[4] ?? fallback), 0, maxValue),
		spe: clamp(Math.floor(arr[5] ?? fallback), 0, maxValue),
	};
}

function toPokemonSet(detail: PokemonDetailLike): PokemonSet | null {
	if (detail.isEgg) return null;
	const species = normalizeText(detail.speciesName) || 'Pikachu';
	const level = clamp(Math.floor(detail.level ?? 50), 1, 100);
	const nature = normalizeText(detail.natureName) || 'Serious';
	const ability = normalizeOptionalName(detail.abilityName);
	const item = normalizeOptionalName(detail.heldItemName);
	const moves = (detail.moveNames ?? []).map(m => normalizeText(m)).filter(Boolean).slice(0, 4);

	return {
		species,
		level,
		nature,
		ability,
		item,
		ivs: arrayToStats(detail.ivs, 31, 31),
		evs: arrayToStats(detail.evs, 0, 252),
		moves,
	};
}

function buildDotnetConfigFromBlazorBoot(dir: URL): Record<string, unknown> {
	const bootUrl = new URL('blazor.boot.json', dir);
	if (!existsSync(bootUrl)) {
		throw new Error(`Missing PKHeX runtime file: ${bootUrl.href}`);
	}

	const bootRaw = JSON.parse(readFileSync(bootUrl, 'utf8')) as {
		mainAssemblyName?: string;
		resources?: {
			assembly?: Record<string, string>;
			wasmNative?: Record<string, string>;
			jsModuleNative?: Record<string, string>;
			jsModuleRuntime?: Record<string, string>;
		};
	};

	const mapToAssets = (obj?: Record<string, string>) => Object.keys(obj ?? {}).map(name => ({ name }));

	return {
		mainAssemblyName: bootRaw.mainAssemblyName ?? 'PKHeX.dll',
		resources: {
			assembly: mapToAssets(bootRaw.resources?.assembly),
			wasmNative: mapToAssets(bootRaw.resources?.wasmNative),
			jsModuleNative: mapToAssets(bootRaw.resources?.jsModuleNative),
			jsModuleRuntime: mapToAssets(bootRaw.resources?.jsModuleRuntime),
		},
	};
}

export async function loadTeamFromSaveFile(savePath: string): Promise<PokemonSet[]> {
	const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<{ default: unknown }>;
	const loadPkhexSetup = async (): Promise<() => Promise<{
		save: {
			load(base64Data: string): ApiResult & { handle?: number };
			dispose(handle: number): ApiResult;
			pokemon: {
				getParty(handle: number): ApiResult | (ApiResult & { party?: PartySummary[] });
				getPartySlot(handle: number, slot: number): ApiResult & PokemonDetailLike;
			};
		};
	}>> => {
		try {
			const mod = await dynamicImport('pkhex');
			if (typeof mod.default === 'function') return mod.default as () => Promise<{
				save: {
					load(base64Data: string): ApiResult & { handle?: number };
					dispose(handle: number): ApiResult;
					pokemon: {
						getParty(handle: number): ApiResult | (ApiResult & { party?: PartySummary[] });
						getPartySlot(handle: number, slot: number): ApiResult & PokemonDetailLike;
					};
				};
			}>;
		} catch {
			// Fall through to path-based import fallback.
		}

		const packageDirs = [
			new URL('../node_modules/pkhex/', import.meta.url),
			pathToFileURL(join(process.cwd(), 'node_modules', 'pkhex') + '/'),
		];

		for (const dir of packageDirs) {
			const dotnetUrl = new URL('dotnet.js', dir);
			const wrapperUrl = new URL('api-wrapper.js', dir);
			if (!existsSync(dotnetUrl) || !existsSync(wrapperUrl)) continue;

			const dotnetMod = await dynamicImport(dotnetUrl.href) as {
				dotnet?: {
					withDiagnosticTracing(v: boolean): {
						withEnvironmentVariable(k: string, v: string): {
							withConfig(config: Record<string, unknown>): {
								create(): Promise<{ getAssemblyExports(assembly: string): Promise<any> }>;
							};
							create(): Promise<{ getAssemblyExports(assembly: string): Promise<any> }>;
						};
					};
				};
			};
			const wrapperMod = await dynamicImport(wrapperUrl.href) as { createPKHeXApiWrapper?: (exports: any) => any };
			const dotnet = dotnetMod.dotnet;
			const createWrapper = wrapperMod.createPKHeXApiWrapper;
			if (!dotnet || typeof createWrapper !== 'function') continue;

			return async () => {
				const config = buildDotnetConfigFromBlazorBoot(dir);
				const { getAssemblyExports } = await dotnet
					.withDiagnosticTracing(false)
					.withEnvironmentVariable('DOTNET_SYSTEM_GLOBALIZATION_INVARIANT', '1')
					.withConfig(config)
					.create();
				const exports = await getAssemblyExports('PKHeX.dll');
				return createWrapper(exports);
			};
		}

		throw new Error('Unable to load PKHeX module. Expected node_modules/pkhex runtime files (dotnet.js and api-wrapper.js).');
	};

	const setupPKHeX = await loadPkhexSetup();

	const pkhex = await setupPKHeX();
	const base64 = readFileSync(savePath).toString('base64');
	const loaded = pkhex.save.load(base64);
	if (!isApiSuccess(loaded) || typeof loaded.handle !== 'number') {
		throw new Error(`Unable to load save file via PKHeX: ${apiError(loaded)}`);
	}

	const handle = loaded.handle;
	try {
		const partyResult = pkhex.save.pokemon.getParty(handle) as unknown;
		const extractedSlots = extractPartySlots(partyResult);
		if (!extractedSlots) {
			throw new Error(`Unable to read party from save file: ${apiError(partyResult)}`);
		}

		const slotCandidates = (extractedSlots.length > 0 ? extractedSlots : [0, 1, 2, 3, 4, 5])
			.filter(s => Number.isInteger(s) && s >= 0 && s < 6);

		const team: PokemonSet[] = [];
		for (const slot of slotCandidates) {
			const detailResult = pkhex.save.pokemon.getPartySlot(handle, slot) as unknown;
			const detail = extractPokemonDetail(detailResult);
			if (!detail) continue;
			const mon = toPokemonSet(detail);
			if (mon) team.push(mon);
		}

		if (team.length === 0) {
			throw new Error('No valid party Pokémon were found in this save file.');
		}

		return team.slice(0, 6);
	} finally {
		pkhex.save.dispose(handle);
	}
}
