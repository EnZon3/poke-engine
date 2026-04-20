export function printCliUsage(packagedBinary: boolean, argsLength: number): void {
	console.log('Usage:');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json [--gen=sv]');
	console.log('  npm start -- --my=my-team.txt --enemy=enemy-team.txt [--gen=sv]');
	console.log('  npm start -- --my=my-team.json --enemy-builder');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=doubles');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --format=singles');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=casual');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --mode=competitive');
	console.log('  npm start -- --my-save=/path/to/main.sav --enemy=enemy-team.json [--gen=sv]');
	console.log('  npm start -- --my=my-team.json --game=sv --trainer=nemona [--gen=9]');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --data-source=pokeapi');
	console.log('  npm start -- --my=my-team.json --against-trainer=sv:nemona');
	console.log('  npm start -- --my=my-team.json --enemy=enemy-team.json --lookahead=3 --allow-switching --weather=rain --defensive-weight=0.3 --opponent-risk-weight=0.55');
	console.log('  npm start -- --tui');
	if (packagedBinary && argsLength === 0) {
		console.log('');
		console.log('Tip: for the guided TUI, download a portable runtime build and run its launcher with no arguments.');
	}
}
