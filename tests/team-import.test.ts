import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShowdownTeam, parseTeamInput } from '../src/team-import.js';

const sample = `Scream Tail @ Booster Energy
Ability: Protosynthesis
Level: 55
Tera Type: Ghost
EVs: 252 hp / 4 atk / 60 def / 4 spd / 188 spe
Jolly Nature
- Rock Tomb
- Encore
- Disable
- Protect

Raging Bolt @ Assault Vest
Ability: Protosynthesis
Level: 75
Tera Type: Fairy
EVs: 188 hp / 92 def / 180 spa / 20 spd / 28 spe
IVs: 20 atk
Modest Nature
- Electroweb
- Dragon Pulse
- Thunderclap
- Snarl`;

test('parseShowdownTeam parses standard Showdown export text', () => {
	const team = parseShowdownTeam(sample);
	assert.equal(team.length, 2);
	assert.equal(team[0].species, 'Scream Tail');
	assert.equal(team[0].item, 'Booster Energy');
	assert.equal(team[0].ability, 'Protosynthesis');
	assert.equal(team[0].level, 55);
	assert.equal(team[0].teraType, 'Ghost');
	assert.equal(team[0].nature, 'Jolly');
	assert.deepEqual(team[0].moves, ['Rock Tomb', 'Encore', 'Disable', 'Protect']);
	assert.equal(team[0].evs.hp, 252);
	assert.equal(team[0].evs.spe, 188);

	assert.equal(team[1].species, 'Raging Bolt');
	assert.equal(team[1].ivs.atk, 20);
	assert.equal(team[1].ivs.hp, 31);
	assert.equal(team[1].evs.spa, 180);
	assert.equal(team[1].nature, 'Modest');
});

test('parseTeamInput supports JSON and Showdown formats', () => {
	const jsonTeam = '[{"species":"Pikachu","level":50,"nature":"Serious","ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"evs":{"hp":0,"atk":0,"def":0,"spa":252,"spd":4,"spe":252},"moves":["Thunderbolt"]}]';
	const fromJson = parseTeamInput(jsonTeam);
	assert.equal(fromJson.length, 1);
	assert.equal(fromJson[0].species, 'Pikachu');

	const fromShowdown = parseTeamInput(sample);
	assert.equal(fromShowdown.length, 2);
	assert.equal(fromShowdown[0].species, 'Scream Tail');
});

test('parseShowdownTeam handles nicknames and gender markers without regex parsing', () => {
	const team = parseShowdownTeam(`Buddy (Flutter Mane) @ Focus Sash
Ability: Protosynthesis
Level: 50
Timid Nature
- Moonblast

Indeedee-F (F) @ Psychic Seed
Ability: Psychic Surge
Level: 50
Calm Nature
- Follow Me`);

	assert.equal(team[0].species, 'Flutter Mane');
	assert.equal(team[0].item, 'Focus Sash');
	assert.equal(team[1].species, 'Indeedee-F');
	assert.equal(team[1].item, 'Psychic Seed');
});

test('parseShowdownTeam handles CRLF and repeated blank lines between sets', () => {
	const team = parseShowdownTeam(`Pikachu @ Light Ball\r
Ability: Static\r
Level: 50\r
Jolly Nature\r
- Thunderbolt\r
\r
\r
Bulbasaur @ Eviolite\r
Ability: Overgrow\r
Level: 50\r
Calm Nature\r
- Giga Drain\r
`);

	assert.equal(team.length, 2);
	assert.equal(team[0].species, 'Pikachu');
	assert.equal(team[1].species, 'Bulbasaur');
});

test('parseShowdownTeam parses case-insensitive field labels and trims move prefixes', () => {
	const team = parseShowdownTeam(`Gengar @ Black Sludge
aBiLiTy: Levitate
lEvEl: 50
tErA tYpE: Ghost
EVs: 4 hp / 252 spa / 252 spe
TiMid Nature
--- Shadow Ball
`);

	assert.equal(team.length, 1);
	assert.equal(team[0].ability, 'Levitate');
	assert.equal(team[0].level, 50);
	assert.equal(team[0].teraType, 'Ghost');
	assert.equal(team[0].evs.spa, 252);
	assert.deepEqual(team[0].moves, ['Shadow Ball']);
});

test('parseShowdownTeam ignores invalid spread tokens while parsing valid entries', () => {
	const team = parseShowdownTeam(`Pikachu
EVs: xyz hp / 252 spe / 4 atk
IVs: ??? spa / 0 atk
Hardy Nature
- Thunderbolt
`);

	assert.equal(team.length, 1);
	assert.equal(team[0].evs.spe, 252);
	assert.equal(team[0].evs.atk, 4);
	assert.equal(team[0].evs.hp, 0);
	assert.equal(team[0].ivs.atk, 0);
	assert.equal(team[0].ivs.spa, 31);
});
