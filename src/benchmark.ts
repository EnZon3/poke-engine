import { loadData } from './data.js';
import { evaluateTeams } from './evaluation/index.js';
import type { EvaluationOptions, PokemonSet } from './types.js';

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

function line(width = 72): string {
	return '─'.repeat(width);
}

type Scenario = {
	name: string;
	format: 'singles' | 'doubles';
	myTeam: PokemonSet[];
	enemy: PokemonSet[];
	enemyKey: string;
	expectedTop3Contains: string[];
	sourceNote: string;
};

// Singles benchmark team (ADV-oriented).
const mySinglesTeam: PokemonSet[] = [
	{
		species: 'Magneton',
		level: 100,
		nature: 'Modest',
		ability: 'Magnet Pull',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 40, atk: 0, def: 0, spa: 252, spd: 0, spe: 216 },
		moves: ['Thunderbolt', 'Hidden Power Fire', 'Substitute', 'Thunder Wave'],
	},
	{
		species: 'Zapdos',
		level: 100,
		nature: 'Timid',
		ability: 'Pressure',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
		moves: ['Thunderbolt', 'Hidden Power Ice', 'Thunder Wave', 'Drill Peck'],
	},
	{
		species: 'Moltres',
		level: 100,
		nature: 'Timid',
		ability: 'Pressure',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
		moves: ['Fire Blast', 'Flamethrower', 'Hidden Power Grass', 'Roar'],
	},
	{
		species: 'Starmie',
		level: 100,
		nature: 'Timid',
		ability: 'Natural Cure',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
		moves: ['Surf', 'Thunderbolt', 'Ice Beam', 'Rapid Spin'],
	},
	{
		species: 'Swampert',
		level: 100,
		nature: 'Relaxed',
		ability: 'Torrent',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 },
		evs: { hp: 252, atk: 0, def: 216, spa: 40, spd: 0, spe: 0 },
		moves: ['Earthquake', 'Surf', 'Ice Beam', 'Protect'],
	},
	{
		species: 'Heracross',
		level: 100,
		nature: 'Adamant',
		ability: 'Guts',
		item: 'Leftovers',
		ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
		evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
		moves: ['Megahorn', 'Brick Break', 'Rock Slide', 'Swords Dance'],
	},
];

// Doubles/VGC benchmark team.
const myDoublesTeam: PokemonSet[] = [
	{
		species: 'Incineroar',
		level: 50,
		nature: 'Careful',
		ability: 'Intimidate',
		item: 'Sitrus Berry',
		ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
		evs: { hp: 252, atk: 44, def: 4, spa: 0, spd: 180, spe: 28 },
		moves: ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Knock Off'],
	},
	{
		species: 'Rillaboom',
		level: 50,
		nature: 'Adamant',
		ability: 'Grassy Surge',
		item: 'Assault Vest',
		ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
		evs: { hp: 236, atk: 196, def: 4, spa: 0, spd: 68, spe: 4 },
		moves: ['Grassy Glide', 'Wood Hammer', 'Fake Out', 'U-turn'],
	},
	{
		species: 'Urshifu-Rapid-Strike',
		level: 50,
		nature: 'Jolly',
		ability: 'Unseen Fist',
		item: 'Mystic Water',
		ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
		evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
		moves: ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'Protect'],
	},
	{
		species: 'Flutter Mane',
		level: 50,
		nature: 'Timid',
		ability: 'Protosynthesis',
		item: 'Booster Energy',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
		moves: ['Moonblast', 'Shadow Ball', 'Icy Wind', 'Protect'],
	},
	{
		species: 'Amoonguss',
		level: 50,
		nature: 'Calm',
		ability: 'Regenerator',
		item: 'Rocky Helmet',
		ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 0 },
		evs: { hp: 236, atk: 0, def: 156, spa: 4, spd: 108, spe: 4 },
		moves: ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect'],
	},
	{
		species: 'Landorus-Therian',
		level: 50,
		nature: 'Adamant',
		ability: 'Intimidate',
		item: 'Choice Scarf',
		ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
		evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
		moves: ['Stomping Tantrum', 'Rock Slide', 'U-turn', 'Tera Blast'],
	},
];

const scenarios: Scenario[] = [
	{
		name: 'Skarmory pressure check',
		format: 'singles',
		myTeam: mySinglesTeam,
		enemy: [{
			species: 'Skarmory',
			level: 100,
			nature: 'Impish',
			ability: 'Keen Eye',
			item: 'Leftovers',
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
			moves: ['Drill Peck', 'Spikes', 'Whirlwind', 'Toxic'],
		}],
		enemyKey: 'Skarmory',
		expectedTop3Contains: ['Magneton', 'Zapdos', 'Moltres'],
		sourceNote: 'Smogon ADV Skarmory checks/counters emphasizes Electric/Fire pressure and Magneton trap dynamics.',
	},
	{
		name: 'Blissey breaker check',
		format: 'singles',
		myTeam: mySinglesTeam,
		enemy: [{
			species: 'Blissey',
			level: 100,
			nature: 'Bold',
			ability: 'Natural Cure',
			item: 'Leftovers',
			ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
			evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
			moves: ['Seismic Toss', 'Soft-Boiled', 'Thunder Wave', 'Ice Beam'],
		}],
		enemyKey: 'Blissey',
		expectedTop3Contains: ['Heracross'],
		sourceNote: 'Smogon ADV Blissey checks/counters: Fighting-types (notably Heracross) consistently pressure Blissey.',
	},
	{
		name: 'Tyranitar counter check',
		format: 'singles',
		myTeam: mySinglesTeam,
		enemy: [{
			species: 'Tyranitar',
			level: 100,
			nature: 'Adamant',
			ability: 'Sand Stream',
			item: 'Leftovers',
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
			moves: ['Rock Slide', 'Earthquake', 'Crunch', 'Dragon Dance'],
		}],
		enemyKey: 'Tyranitar',
		expectedTop3Contains: ['Heracross', 'Swampert'],
		sourceNote: 'Smogon ADV Tyranitar checks/counters repeatedly cite Fighting- and Ground/Water-based pressure as primary answers.',
	},
	{
		name: 'Aerodactyl anti-air check',
		format: 'singles',
		myTeam: mySinglesTeam,
		enemy: [{
			species: 'Aerodactyl',
			level: 100,
			nature: 'Jolly',
			ability: 'Rock Head',
			item: 'Choice Band',
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
			moves: ['Rock Slide', 'Earthquake', 'Double-Edge', 'Aerial Ace'],
		}],
		enemyKey: 'Aerodactyl',
		expectedTop3Contains: ['Swampert', 'Starmie'],
		sourceNote: 'ADV consensus has bulky Water/Rock-resistant responses as reliable Aerodactyl checks; Swampert and Starmie are common answers.',
	},
	{
		name: 'Salamence anti-Dragon check',
		format: 'singles',
		myTeam: mySinglesTeam,
		enemy: [{
			species: 'Salamence',
			level: 100,
			nature: 'Naive',
			ability: 'Intimidate',
			item: 'Leftovers',
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			evs: { hp: 40, atk: 252, def: 0, spa: 0, spd: 0, spe: 216 },
			moves: ['Hidden Power Flying', 'Earthquake', 'Fire Blast', 'Rock Slide'],
		}],
		enemyKey: 'Salamence',
		expectedTop3Contains: ['Starmie', 'Zapdos'],
		sourceNote: 'ADV play commonly relies on Ice coverage and strong neutral special pressure into Salamence; Starmie/Zapdos align with this.',
	},
	{
		name: 'VGC lead pressure: Heatran + Landorus-T',
		format: 'doubles',
		myTeam: myDoublesTeam,
		enemy: [
			{
				species: 'Heatran',
				level: 50,
				nature: 'Modest',
				ability: 'Flash Fire',
				item: 'Shuca Berry',
				ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
				evs: { hp: 124, atk: 0, def: 4, spa: 252, spd: 4, spe: 124 },
				moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
			},
			{
				species: 'Landorus-Therian',
				level: 50,
				nature: 'Jolly',
				ability: 'Intimidate',
				item: 'Choice Scarf',
				ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
				evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
				moves: ['Stomping Tantrum', 'Rock Slide', 'U-turn', 'Tera Blast'],
			},
		],
		enemyKey: 'Heatran + Landorus-Therian',
		expectedTop3Contains: ['Rillaboom + Urshifu-Rapid-Strike'],
		sourceNote: 'VGC consensus emphasizes Water/Fighting pressure and speed control utility into this Fire/Ground-oriented lead shell.',
	},
	{
		name: 'VGC lead pressure: Incineroar + Rillaboom',
		format: 'doubles',
		myTeam: myDoublesTeam,
		enemy: [
			{
				species: 'Incineroar',
				level: 50,
				nature: 'Careful',
				ability: 'Intimidate',
				item: 'Sitrus Berry',
				ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
				evs: { hp: 252, atk: 44, def: 4, spa: 0, spd: 180, spe: 28 },
				moves: ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Knock Off'],
			},
			{
				species: 'Rillaboom',
				level: 50,
				nature: 'Adamant',
				ability: 'Grassy Surge',
				item: 'Assault Vest',
				ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
				evs: { hp: 236, atk: 196, def: 4, spa: 0, spd: 68, spe: 4 },
				moves: ['Grassy Glide', 'Wood Hammer', 'Fake Out', 'U-turn'],
			},
		],
		enemyKey: 'Incineroar + Rillaboom',
		expectedTop3Contains: ['Flutter Mane + Landorus-Therian'],
		sourceNote: 'VGC play patterns often answer Incineroar/Rillaboom with strong Ground/Fairy pressure and speed utility to avoid Fake Out loops.',
	},
	{
		name: 'VGC speed-control check: Urshifu-RS + Flutter Mane',
		format: 'doubles',
		myTeam: myDoublesTeam,
		enemy: [
			{
				species: 'Urshifu-Rapid-Strike',
				level: 50,
				nature: 'Jolly',
				ability: 'Unseen Fist',
				item: 'Mystic Water',
				ivs: { hp: 31, atk: 31, def: 31, spa: 0, spd: 31, spe: 31 },
				evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
				moves: ['Surging Strikes', 'Close Combat', 'Aqua Jet', 'Protect'],
			},
			{
				species: 'Flutter Mane',
				level: 50,
				nature: 'Timid',
				ability: 'Protosynthesis',
				item: 'Booster Energy',
				ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
				evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
				moves: ['Moonblast', 'Shadow Ball', 'Icy Wind', 'Protect'],
			},
		],
		enemyKey: 'Urshifu-Rapid-Strike + Flutter Mane',
		expectedTop3Contains: ['Incineroar + Amoonguss'],
		sourceNote: 'VGC resources repeatedly stress speed control + redirection + Fake Out as practical tools against fast pressure leads.',
	},
];

async function run(): Promise<void> {
	await loadData(3, 'showdown');

	let passed = 0;
	console.log(`\n${bold('Benchmark validation')}`);
	console.log(dim(line()));
	console.log(dim(`Scenarios: ${scenarios.length}`));
	for (const scenario of scenarios) {
		const options: EvaluationOptions = {
			mode: 'competitive',
			battleFormat: scenario.format,
			allowSwitching: false,
			battleState: { weather: 'none', terrain: 'none', mySide: {}, enemySide: {} },
		};
		const result = evaluateTeams(scenario.myTeam, scenario.enemy, options);
		const top3 = (result[scenario.enemyKey] ?? []).slice(0, 3).map((x) => x.pokemon);
		const missing = scenario.expectedTop3Contains.filter((name) => !top3.includes(name));
		const ok = missing.length === 0;
		if (ok) passed += 1;

		const statusText = ok ? paint('PASS', ANSI.green) : paint('FAIL', ANSI.red);
		const icon = ok ? paint('✓', ANSI.green) : paint('✗', ANSI.red);
		const formatTag = paint(scenario.format.toUpperCase(), ANSI.cyan);

		console.log(`\n${dim(line())}`);
		console.log(`${icon} [${statusText}] ${bold(scenario.name)} ${dim(`(${formatTag})`)}`);
		console.log(`${paint('Top 3', ANSI.cyan)}      ${top3.join('  •  ')}`);
		console.log(`${dim('Reference')}  ${scenario.sourceNote}`);
		if (!ok) {
			console.log(`${paint('Missing', ANSI.yellow)}    ${missing.join(', ')}`);
			console.log(`${dim('Expected')}  ${scenario.expectedTop3Contains.join(', ')}`);
		}
	}

	const failed = scenarios.length - passed;
	const finalStatus = failed === 0 ? paint('ALL PASS', ANSI.green) : paint('HAS FAILURES', ANSI.red);

	console.log(`\n${bold('Validation summary')}`);
	console.log(dim(line()));
	console.log(`Status: ${finalStatus}`);
	console.log(`Passed: ${paint(String(passed), ANSI.green)} / ${scenarios.length}`);
	if (failed > 0) {
		console.log(`Failed: ${paint(String(failed), ANSI.red)}`);
	}
	if (passed !== scenarios.length) process.exitCode = 1;
}

void run();
