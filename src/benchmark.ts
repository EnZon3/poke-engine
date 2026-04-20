import { loadData } from './data.js';
import { evaluateTeams } from './evaluation/index.js';
import { scenarios } from './benchmark-scenarios.js';
import { horizontalRule } from './reporting/console.js';
import type { EvaluationOptions } from './types.js';

const ANSI = {
	reset: '\u001b[0m',
	bold: '\u001b[1m',
	dim: '\u001b[2m',
	red: '\u001b[31m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
	cyan: '\u001b[36m',
} as const;

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function paint(text: string, color: string): string {
	return useColor ? `${color}${text}${ANSI.reset}` : text;
}

function bold(text: string): string {
	return paint(text, ANSI.bold);
}

function dim(text: string): string {
	return paint(text, ANSI.dim);
}

async function run(): Promise<void> {
	await loadData(undefined, 'showdown');

	let passed = 0;
	console.log(`\n${bold('Benchmark validation')}`);
	console.log(dim(horizontalRule()));
	console.log(dim(`Scenarios: ${scenarios.length}`));
	for (const scenario of scenarios) {
		await loadData(scenario.gen, 'showdown');
		const options: EvaluationOptions = {
			mode: 'competitive',
			battleFormat: scenario.format,
			mechanicsPolicy: scenario.mechanicsPolicy ?? 'generation-default',
			allowSwitching: false,
			battleState: { weather: 'none', terrain: 'none', mySide: {}, enemySide: {} },
		};
		const result = evaluateTeams(scenario.myTeam, scenario.enemy, options);
		const ranked = (result[scenario.enemyKey] ?? []).slice(0, 3);
		const top3 = ranked.map((x) => x.pokemon);
		const missing = scenario.expectedTop3Contains.filter((name) => !top3.includes(name));

		const scoreErrors: string[] = [];
		if (scenario.scoreTolerance) {
			const [top1] = ranked;
			if (!top1) {
				scoreErrors.push('insufficient ranked results for score checks');
			} else {
				if (scenario.scoreTolerance.minTop1Score !== undefined && top1.score < scenario.scoreTolerance.minTop1Score) {
					scoreErrors.push(`top1 score ${(top1.score * 100).toFixed(2)}% < min ${(scenario.scoreTolerance.minTop1Score * 100).toFixed(2)}%`);
				}
				if (scenario.scoreTolerance.maxTop1Score !== undefined && top1.score > scenario.scoreTolerance.maxTop1Score) {
					scoreErrors.push(`top1 score ${(top1.score * 100).toFixed(2)}% > max ${(scenario.scoreTolerance.maxTop1Score * 100).toFixed(2)}%`);
				}
			}
		}
		if (scenario.format === 'doubles' && scenario.doublesScoreTolerance) {
			const [top1, top2, top3Entry] = ranked;
			if (!top1 || !top2 || !top3Entry) {
				scoreErrors.push('insufficient ranked results for doubles score checks');
			} else {
				if (scenario.doublesScoreTolerance.minTop1Score !== undefined && top1.score < scenario.doublesScoreTolerance.minTop1Score) {
					scoreErrors.push(`top1 score ${(top1.score * 100).toFixed(2)}% < min ${(scenario.doublesScoreTolerance.minTop1Score * 100).toFixed(2)}%`);
				}
				if (scenario.doublesScoreTolerance.minTop1VsTop2Gap !== undefined) {
					const gap = top1.score - top2.score;
					if (gap < scenario.doublesScoreTolerance.minTop1VsTop2Gap) {
						scoreErrors.push(`top1-top2 gap ${(gap * 100).toFixed(2)}% < min ${(scenario.doublesScoreTolerance.minTop1VsTop2Gap * 100).toFixed(2)}%`);
					}
				}
				if (scenario.doublesScoreTolerance.minTop1VsTop3Gap !== undefined) {
					const gap = top1.score - top3Entry.score;
					if (gap < scenario.doublesScoreTolerance.minTop1VsTop3Gap) {
						scoreErrors.push(`top1-top3 gap ${(gap * 100).toFixed(2)}% < min ${(scenario.doublesScoreTolerance.minTop1VsTop3Gap * 100).toFixed(2)}%`);
					}
				}
			}
		}

		const ok = missing.length === 0 && scoreErrors.length === 0;
		if (ok) passed += 1;

		const statusText = ok ? paint('PASS', ANSI.green) : paint('FAIL', ANSI.red);
		const icon = ok ? paint('✓', ANSI.green) : paint('✗', ANSI.red);
		const formatTag = paint(scenario.format.toUpperCase(), ANSI.cyan);

		console.log(`\n${dim(horizontalRule())}`);
		console.log(`${icon} [${statusText}] ${bold(scenario.name)} ${dim(`(${formatTag})`)}`);
		console.log(`${paint('Top 3', ANSI.cyan)}      ${top3.join('  •  ')}`);
		if (scenario.format === 'doubles' && ranked.length > 0) {
			console.log(`${dim('Scores')}     ${ranked.map((x) => `${x.pokemon} ${(x.score * 100).toFixed(2)}%`).join('  •  ')}`);
		}
		console.log(`${dim('Reference')}  ${scenario.sourceNote}`);
		if (!ok) {
			if (missing.length > 0) {
				console.log(`${paint('Missing', ANSI.yellow)}    ${missing.join(', ')}`);
				console.log(`${dim('Expected')}  ${scenario.expectedTop3Contains.join(', ')}`);
			}
			for (const err of scoreErrors) {
				console.log(`${paint('Tolerance', ANSI.yellow)}  ${err}`);
			}
		}
	}

	const failed = scenarios.length - passed;
	const finalStatus = failed === 0 ? paint('ALL PASS', ANSI.green) : paint('HAS FAILURES', ANSI.red);

	console.log(`\n${bold('Validation summary')}`);
	console.log(dim(horizontalRule()));
	console.log(`Status: ${finalStatus}`);
	console.log(`Passed: ${paint(String(passed), ANSI.green)} / ${scenarios.length}`);
	if (failed > 0) {
		console.log(`Failed: ${paint(String(failed), ANSI.red)}`);
	}
	if (passed !== scenarios.length) process.exitCode = 1;
}

void run();
