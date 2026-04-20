import type { CliResult, MatchupEvaluation } from '../types.js';
import { formatPercent, renderPercentBar, truncateText } from './utils.js';

function panelInnerWidth(width: number, paddingX = 1): number {
	return Math.max(1, width - 2 - paddingX * 2);
}

function pickTacticalNotes(notes: string[]): { primaryNote: string; secondaryNote?: string } {
	const gimmickNote = notes.find((note) => note.startsWith('Auto gimmick timing selected:'));
	const responseNote = notes.find((note) => note.startsWith('Opponent best response assumes:'));
	const primaryNote = gimmickNote ?? responseNote ?? notes[0] ?? 'No tactical note.';
	const secondaryNote = responseNote && responseNote !== primaryNote
		? responseNote
		: (gimmickNote && gimmickNote !== primaryNote ? gimmickNote : undefined);
	return { primaryNote, secondaryNote };
}

export type ResultsCardViewModel = {
	enemy: string;
	idx: number;
	picks: MatchupEvaluation[];
	best?: MatchupEvaluation;
	isSelected: boolean;
	isExpanded: boolean;
	activeCardWidth: number;
	activeCardTextWidth: number;
	bestName: string;
	roleSuffix: string;
	moveLine: string;
	damageLine: string;
	altText: string;
	noteLine: string;
	bestScorePct: number;
	bestScoreBar: string;
	scoreBarColor: 'green' | 'red' | undefined;
};

export type ResultsViewModel = {
	entriesCount: number;
	pageStart: number;
	pageEnd: number;
	gridHeight: number;
	cardColumns: number;
	cardWidth: number;
	cardTextWidth: number;
	expandedCardWidth: number;
	expandedCardTextWidth: number;
	cardHeight: number;
	expandedCardHeight: number;
	cards: ResultsCardViewModel[];
};

export function buildResultsViewModel(
	results: CliResult | null,
	selectedIndex: number,
	expandedEnemyKey: string | null,
	terminalColumns: number,
	terminalRows: number,
	hasError = false,
): ResultsViewModel {
	const entries = Object.entries(results ?? {});
	const screenWidth = Math.max(1, terminalColumns);
	const screenHeight = Math.max(1, terminalRows);
	const contentWidth = Math.max(20, screenWidth - 4);
	const innerHeight = Math.max(1, screenHeight - 2);
	const cardMinWidth = 54;
	const cardMaxWidth = 72;
	const cardHeight = 9;
	const expandedCardHeight = screenHeight >= 28 ? 20 : 14;
	const cardOuterHeight = cardHeight + 1;
	const expandedCardOuterHeight = expandedCardHeight + 1;
	const maxCardColumns = Math.max(1, Math.min(4, Math.floor((contentWidth + 1) / (cardMinWidth + 1))));
	const cardColumns = Math.max(1, Math.min(entries.length || 1, maxCardColumns));
	const cardWidth = Math.max(20, Math.min(cardMaxWidth, Math.floor((contentWidth - Math.max(0, cardColumns - 1)) / cardColumns)));
	const cardTextWidth = panelInnerWidth(cardWidth);
	const expandedCardWidth = contentWidth;
	const expandedCardTextWidth = panelInnerWidth(expandedCardWidth);
	const footerRows = hasError ? 2 : 1;
	const headerRows = 3;
	const gridHeight = Math.max(cardOuterHeight, innerHeight - headerRows - footerRows);
	const gridRows = Math.max(1, Math.floor(gridHeight / cardOuterHeight));
	const expandedGridRows = Math.max(0, Math.floor((gridHeight - expandedCardOuterHeight) / cardOuterHeight));
	const basePageSize = Math.max(1, cardColumns * gridRows);
	const expandedPageSize = Math.max(1, Math.min(basePageSize, 1 + cardColumns * expandedGridRows));
	const boundedSelectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, entries.length - 1)));
	const selectedEntry = entries[boundedSelectedIndex];
	const selectedIsExpanded = Boolean(selectedEntry && expandedEnemyKey === selectedEntry[0]);
	const pageSize = selectedIsExpanded ? expandedPageSize : basePageSize;
	const pageStart = selectedIsExpanded ? boundedSelectedIndex : Math.floor(boundedSelectedIndex / pageSize) * pageSize;
	const visibleEntries = entries.slice(pageStart, pageStart + pageSize);
	const pageEnd = Math.min(entries.length, pageStart + visibleEntries.length);

	const cards: ResultsCardViewModel[] = visibleEntries.map(([enemy, picks], localIdx) => {
		const idx = pageStart + localIdx;
		const [best, second, third] = picks;
		const isSelected = idx === selectedIndex;
		const isExpanded = expandedEnemyKey === enemy;
		const activeCardWidth = isExpanded ? expandedCardWidth : cardWidth;
		const activeCardTextWidth = isExpanded ? expandedCardTextWidth : cardTextWidth;
		const bestScorePct = best ? best.score * 100 : 0;
		const bestScoreBar = renderPercentBar(Math.min(100, Math.abs(bestScorePct)), 8);
		const scoreBarColor: 'green' | 'red' | undefined = bestScorePct <= 0 ? 'red' : (bestScorePct >= 100 ? 'green' : undefined);
		const twoHkoValue = best?.twoHkoChance ?? 0;
		const dmgMin = best?.minDamagePercent?.toFixed(1) ?? '-';
		const dmgMax = best?.maxDamagePercent?.toFixed(1) ?? '-';
		const altText = [second, third]
			.filter(Boolean)
			.map((p, i) => `#${i + 2} ${truncateText(p.pokemon, Math.max(8, Math.floor(activeCardTextWidth / 3)))} ${(p.score * 100).toFixed(0)}%`)
			.join(' | ');
		const notes = best?.notes ?? [];
		const { primaryNote, secondaryNote } = pickTacticalNotes(notes);
		const confidence = best?.confidence ?? 'Low';
		const bestName = best ? truncateText(best.pokemon, Math.max(8, activeCardTextWidth - 16)) : '';
		const roleSuffix = best?.role ? ` (${best.role})` : '';
		const moveLine = best ? `Move ${best.move ?? '(none)'} | Conf ${confidence}` : '';
		const damageLine = `Dmg ${dmgMin}-${dmgMax}% | 2HKO ${formatPercent(twoHkoValue)}`;
		const noteLine = secondaryNote ? `${primaryNote} / ${secondaryNote}` : primaryNote;

		return {
			enemy,
			idx,
			picks,
			best,
			isSelected,
			isExpanded,
			activeCardWidth,
			activeCardTextWidth,
			bestName,
			roleSuffix,
			moveLine,
			damageLine,
			altText,
			noteLine,
			bestScorePct,
			bestScoreBar,
			scoreBarColor,
		};
	});

	return {
		entriesCount: entries.length,
		pageStart,
		pageEnd,
		gridHeight,
		cardColumns,
		cardWidth,
		cardTextWidth,
		expandedCardWidth,
		expandedCardTextWidth,
		cardHeight,
		expandedCardHeight,
		cards,
	};
}
