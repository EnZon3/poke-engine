export function splitLines(value: string): string[] {
	const lines: string[] = [];
	let start = 0;
	for (let i = 0; i < value.length; i += 1) {
		if (value[i] !== '\n') continue;
		const end = i > start && value[i - 1] === '\r' ? i - 1 : i;
		lines.push(value.slice(start, end));
		start = i + 1;
	}
	lines.push(value.slice(start));
	return lines;
}

export function splitTeamBlocks(value: string): string[] {
	const blocks: string[] = [];
	let current: string[] = [];
	for (const rawLine of splitLines(value.trim())) {
		if (rawLine.trim()) {
			current.push(rawLine);
			continue;
		}
		if (current.length > 0) {
			blocks.push(current.join('\n'));
			current = [];
		}
	}
	if (current.length > 0) blocks.push(current.join('\n'));
	return blocks;
}
