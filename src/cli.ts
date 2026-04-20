import { executeCliPlan } from './cli/execute.js';
import { parseCliArgs } from './cli/options.js';

export function isMain(): boolean {
	const hasRequire = typeof require !== 'undefined';
	if (hasRequire) {
		// @ts-ignore
		return require.main === module;
	}
	if (typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
		if (import.meta.url.startsWith('file://')) {
			const decoded = decodeURI(import.meta.url.slice('file://'.length));
			return !!process.argv[1] && process.argv[1] === decoded;
		}
		return false;
	}
	return false;
}

export async function runCli(): Promise<void> {
	const args = process.argv.slice(2);
	const packagedBinary = Boolean((process as { pkg?: unknown }).pkg);
	const parsed = parseCliArgs(args, packagedBinary);
	await executeCliPlan(parsed, packagedBinary, args.length);
}
