export function horizontalRule(width = 72, char = '─'): string {
	return char.repeat(Math.max(1, width));
}
