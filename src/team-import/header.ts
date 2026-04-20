function stripGenderSuffix(value: string): string {
	const lowerValue = value.toLowerCase();
	if (lowerValue.endsWith(' (m)') || lowerValue.endsWith(' (f)')) {
		return value.slice(0, -4).trim();
	}
	const genderSuffix = value.slice(-3).toLowerCase();
	if (genderSuffix === ', m' || genderSuffix === ', f') {
		return value.slice(0, -3).trim();
	}
	return value;
}

export function speciesFromShowdownHeader(raw: string): string {
	let value = raw.trim();
	const atIndex = value.indexOf('@');
	if (atIndex >= 0) value = value.slice(0, atIndex).trim();

	if (value.endsWith(')')) {
		const openIndex = value.lastIndexOf('(');
		const inner = openIndex >= 0 ? value.slice(openIndex + 1, -1).trim() : '';
		const lowerInner = inner.toLowerCase();
		if (inner && lowerInner !== 'm' && lowerInner !== 'f' && !inner.includes('(') && !inner.includes(')')) {
			value = inner;
		}
	}
	return stripGenderSuffix(value);
}

export function itemFromShowdownHeader(raw: string): string | undefined {
	const atIndex = raw.indexOf('@');
	if (atIndex < 0) return undefined;
	const item = raw.slice(atIndex + 1).trim();
	return item || undefined;
}
