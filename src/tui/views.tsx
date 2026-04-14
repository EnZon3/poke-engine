import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { CliResult, PokemonSet } from '../types.js';
import type { EditorField, SetupQuestion } from './model.js';
import { formatPercent, getFieldValue, renderPercentBar, scoreColor, statsToCsv, truncateText, wrapText } from './utils.js';

type TerminalSizeProps = {
	terminalColumns: number;
	terminalRows: number;
};

function fitToTerminal(value: number, maxValue: number): number {
	return Math.max(1, Math.min(value, maxValue));
}

function panelInnerWidth(width: number, paddingX = 1): number {
	return Math.max(1, width - 2 - paddingX * 2);
}

function renderWithInlineCode(value: string): React.ReactNode {
	const parts = value.split(/(`[^`]+`)/g).filter(Boolean);
	return parts.map((part, idx) => {
		if (part.startsWith('`') && part.endsWith('`')) {
			return (
				<Text key={`code-${idx}`} color="yellow" bold>
					{part.slice(1, -1)}
				</Text>
			);
		}
		return <React.Fragment key={`text-${idx}`}>{part}</React.Fragment>;
	});
}

type SetupViewProps = {
	setupIndex: number;
	setupQuestionsLength: number;
	activeQuestion?: SetupQuestion;
	error: string | null;
	statusMsg: string;
} & TerminalSizeProps;

export function SetupView({ setupIndex, setupQuestionsLength, activeQuestion, error, statusMsg, terminalColumns, terminalRows }: SetupViewProps): React.JSX.Element {
	const screenWidth = Math.max(1, terminalColumns);
	const screenHeight = Math.max(1, terminalRows);
	const panelWidth = fitToTerminal(terminalColumns - 4, 88);
	return (
		<Box flexDirection="column" alignItems="center" justifyContent="center" height={screenHeight} width={screenWidth}>
			<Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column" width={panelWidth}>
				<Text bold color="cyan">Teambuilder Setup</Text>
				<Text dimColor>{`Step ${Math.min(setupIndex + 1, setupQuestionsLength)} of ${setupQuestionsLength}`}</Text>
				<Box marginTop={1}>
					<Text>{activeQuestion?.label ?? 'Loading...'}</Text>
				</Box>
				{activeQuestion?.kind === 'select' && activeQuestion.options ? (
					<Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
						{activeQuestion.options.map(opt => (
							<Text key={opt.value} color={activeQuestion.value === opt.value ? 'yellow' : undefined}>
								{activeQuestion.value === opt.value ? '▶ ' : '  '}{opt.label}
							</Text>
						))}
					</Box>
				) : (
					<Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
						{activeQuestion ? (
							<TextInput value={activeQuestion.value} onChange={activeQuestion.setValue} />
						) : (
							<Text>...</Text>
						)}
					</Box>
				)}
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Enter: next / confirm</Text>
					<Text dimColor>Selects: Up/Down changes option</Text>
					<Text dimColor>Left Arrow: previous question</Text>
					<Text dimColor>Esc / Ctrl+C: exit</Text>
				</Box>
				{error ? <Text color="red">Error: {error}</Text> : null}
				{statusMsg ? <Text color="green">{statusMsg}</Text> : null}
			</Box>
		</Box>
	);
}

type EditorViewProps = {
	editingSide: 'my' | 'enemy';
	myTeam: PokemonSet[];
	enemyTeam: PokemonSet[];
	selectedMyPokemon: number;
	selectedEnemyPokemon: number;
	selectedPokemon: number;
	selectedField: number;
	fields: readonly EditorField[];
	activePokemon: PokemonSet;
	editMode: boolean;
	editBuffer: string;
	setEditBuffer: (v: string) => void;
	savePrompt: boolean;
	savePath: string;
	setSavePath: (v: string) => void;
	statusMsg: string;
	error: string | null;
} & TerminalSizeProps;

export function EditorView(props: EditorViewProps): React.JSX.Element {
	const {
		editingSide,
		myTeam,
		enemyTeam,
		selectedMyPokemon,
		selectedEnemyPokemon,
		selectedPokemon,
		selectedField,
		fields,
		activePokemon,
		editMode,
		editBuffer,
		setEditBuffer,
		savePrompt,
		savePath,
		setSavePath,
		statusMsg,
		error,
		terminalColumns,
		terminalRows,
	} = props;
	const screenWidth = Math.max(1, terminalColumns);
	const screenHeight = Math.max(1, terminalRows);
	const editorWidth = fitToTerminal(terminalColumns - 4, 150);
	const editorGap = editorWidth >= 80 ? 1 : 0;
	const panelAreaWidth = Math.max(1, editorWidth - editorGap * 2);
	const partyWidth = Math.max(1, Math.floor(panelAreaWidth * 0.3));
	const activeWidth = Math.max(1, Math.floor(panelAreaWidth * 0.4));
	const opponentWidth = Math.max(1, panelAreaWidth - partyWidth - activeWidth);
	const partyTextWidth = panelInnerWidth(partyWidth);
	const activeTextWidth = panelInnerWidth(activeWidth);
	const opponentTextWidth = panelInnerWidth(opponentWidth);

	return (
		<Box flexDirection="column" width={screenWidth} height={screenHeight} alignItems="center" justifyContent="center" overflow="hidden">
			<Box flexDirection="column" width={editorWidth}>
				<Box columnGap={editorGap}>
					<Box width={partyWidth} borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
						<Text bold wrap="truncate-end">Party {editingSide === 'my' ? '(editing)' : ''}</Text>
						{myTeam.map((mon, idx) => (
							<Text key={`${mon.species}-${idx}`} color={editingSide === 'my' && idx === selectedMyPokemon ? 'yellow' : undefined} wrap="truncate-end">
								{editingSide === 'my' && idx === selectedMyPokemon ? '▶ ' : '  '}
								{truncateText(`${idx + 1}. ${mon.species} Lv${mon.level}`, Math.max(1, partyTextWidth - 2))}
							</Text>
						))}
					</Box>
					<Box width={activeWidth} borderStyle="round" borderColor="green" flexDirection="column" paddingX={1}>
						<Text bold wrap="truncate-end">Step-by-step Config Editor</Text>
						<Text wrap="truncate-end">Editing: {editingSide === 'my' ? 'Your team' : 'Enemy team'}</Text>
						<Text wrap="truncate-end">Selected slot: {selectedPokemon + 1}</Text>
						<Text dimColor wrap="truncate-end">IVs: {statsToCsv(activePokemon.ivs)}</Text>
						<Text dimColor wrap="truncate-end">EVs: {statsToCsv(activePokemon.evs)}</Text>
						{fields.map((field, idx) => (
							<Text key={field} color={idx === selectedField ? 'yellow' : undefined} wrap="truncate-end">
								{idx === selectedField ? '▶ ' : '  '}
								{truncateText(`${field}: ${getFieldValue(field, activePokemon) || '(empty)'}`, Math.max(1, activeTextWidth - 2))}
							</Text>
						))}
						{editMode ? (
							<Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1}>
								<TextInput value={editBuffer} onChange={setEditBuffer} />
							</Box>
						) : null}
						{savePrompt ? (
							<Box marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
								<Text>Save path: </Text>
								<TextInput value={savePath} onChange={setSavePath} />
							</Box>
						) : null}
					</Box>
					<Box width={opponentWidth} borderStyle="round" borderColor="blue" flexDirection="column" paddingX={1}>
						<Text bold wrap="truncate-end">Opponent Team {editingSide === 'enemy' ? '(editing)' : ''}</Text>
						{enemyTeam.length === 0 ? <Text dimColor wrap="truncate-end">No opponent loaded.</Text> : null}
						{enemyTeam.slice(0, 6).map((mon, idx) => (
							<Text key={`${mon.species}-${idx}`} color={editingSide === 'enemy' && idx === selectedEnemyPokemon ? 'yellow' : undefined} wrap="truncate-end">
								{editingSide === 'enemy' && idx === selectedEnemyPokemon ? '▶ ' : '  '}
								{truncateText(`${idx + 1}. ${mon.species} Lv${mon.level}`, Math.max(1, opponentTextWidth - 2))}
							</Text>
						))}
					</Box>
				</Box>
				<Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
					<Text dimColor wrap="truncate-end">Arrows: navigate | e: edit field | Enter: commit edit | Esc: cancel edit</Text>
					<Text dimColor wrap="truncate-end">o: toggle side (my/enemy) | a: add slot | x: delete slot | p: estimate IV/EV | s: save active team JSON | c: calculate | q/Ctrl+C: quit</Text>
					{statusMsg ? <Text color="green" wrap="truncate-end">{statusMsg}</Text> : null}
					{error ? <Text color="red" wrap="truncate-end">Error: {error}</Text> : null}
				</Box>
			</Box>
		</Box>
	);
}

export function HelpView(): React.JSX.Element {
	return (
		<Box width="100%" height="100%" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column">
			<Text bold color="yellow">Matchup Interpretation Help</Text>
			<Text color="cyan">How to read each output</Text>
			<Text>{renderWithInlineCode('• `score`: net expected advantage over the lookahead window. Positive means your side is projected to come out ahead in HP exchange.')}</Text>
			<Text>{renderWithInlineCode('• `min/max damage %`: one-hit damage band against current target HP using in-game style 85%-100% random rolls.')}</Text>
			<Text>{renderWithInlineCode('• `1HKO/2HKO`: chance to KO in one or two attacks from roll+accuracy+status action checks.')}</Text>
			<Text>{renderWithInlineCode('• `speed+`: your side is expected to act first within the same priority bracket.')}</Text>
			<Text>{renderWithInlineCode('• `role`: heuristic tag (`cleaner`, `wallbreaker`, `wall`, `pivot`, `balanced`) to help draft a game plan.')}</Text>
			<Text>{renderWithInlineCode('• `notes`: tactical warnings/bonuses (speed tie, setup line discovered, hazard switch penalty).')}</Text>

			<Box marginTop={1}>
				<Text color="cyan">Battle-planning workflow</Text>
			</Box>
			<Text>{renderWithInlineCode('1) Identify your best 2-3 candidates into each enemy, not just rank #1.')}</Text>
			<Text>{renderWithInlineCode('2) If two picks are close, prioritize the one with better `speed+` or higher 2HKO reliability.')}</Text>
			<Text>3) If notes mention setup discovery, treat that line as a conditional win-path and check survival turn 1.</Text>
			<Text>4) Recalculate after changing weather/terrain/screens/hazards to compare alternate game states.</Text>
			<Text>5) Save party snapshots before major edits so you can A/B compare matchup matrices quickly.</Text>

			<Box marginTop={1}>
				<Text color="cyan">Practical thresholds</Text>
			</Box>
			<Text>{renderWithInlineCode('• `1HKO ≥ 70%`: strong immediate pressure.')}</Text>
			<Text>{renderWithInlineCode('• `2HKO ≥ 90%` with `speed+`: reliable cleaner/revenge line.')}</Text>
			<Text>{renderWithInlineCode('• Positive `score` but low KO odds: likely pivot/chip role rather than finisher role.')}</Text>
			<Text>{renderWithInlineCode('• Negative `score` with no setup notes: avoid as primary answer unless needed for utility.')}</Text>

			<Box marginTop={1}><Text dimColor>h: close help | b: back to editor | r: recompute | q: quit</Text></Box>
		</Box>
	);
}

export function ResultsView(
	{ results, error, selectedIndex = 0, expandedEnemyKey = null, terminalColumns, terminalRows }: {
		results: CliResult | null;
		error: string | null;
		selectedIndex?: number;
		expandedEnemyKey?: string | null;
	} & TerminalSizeProps,
): React.JSX.Element {
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
	const footerRows = 1 + (error ? 1 : 0);
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
	return (
		<Box width={screenWidth} height={screenHeight} flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} overflow="hidden">
			<Text bold color="green" wrap="truncate-end">Matchup Results</Text>
			<Text dimColor wrap="truncate-end">showing {entries.length === 0 ? '0' : `${pageStart + 1}-${pageEnd}`} of {entries.length}</Text>
			{results ? (
				<Box flexWrap="wrap" marginTop={1} height={gridHeight} overflow="hidden">
					{visibleEntries.map(([enemy, picks], localIdx) => {
						const idx = pageStart + localIdx;
						const [best, second, third] = picks;
						const isSelected = idx === selectedIndex;
						const isExpanded = expandedEnemyKey === enemy;
						const activeCardWidth = isExpanded ? expandedCardWidth : cardWidth;
						const activeCardTextWidth = isExpanded ? expandedCardTextWidth : cardTextWidth;
						const bestScorePct = best ? best.score * 100 : 0;
						const bestScoreMagnitudePct = Math.abs(bestScorePct);
						const bestScoreBar = renderPercentBar(Math.min(100, bestScoreMagnitudePct), 8);
						const scoreBarColor: 'green' | 'red' | undefined = bestScorePct <= 0 ? 'red' : (bestScorePct >= 100 ? 'green' : undefined);
						const twoHkoValue = best?.twoHkoChance ?? 0;
						const dmgMin = best?.minDamagePercent?.toFixed(1) ?? '-';
						const dmgMax = best?.maxDamagePercent?.toFixed(1) ?? '-';
						const altText = [second, third]
							.filter(Boolean)
							.map((p, i) => `#${i + 2} ${truncateText(p.pokemon, Math.max(8, Math.floor(activeCardTextWidth / 3)))} ${(p.score * 100).toFixed(0)}%`)
							.join(' | ');
						const notes = best?.notes ?? [];
						const gimmickNote = notes.find((note) => note.startsWith('Auto gimmick timing selected:'));
						const responseNote = notes.find((note) => note.startsWith('Opponent best response assumes:'));
						const primaryNote = gimmickNote ?? responseNote ?? notes[0] ?? 'No tactical note.';
						const secondaryNote = responseNote && responseNote !== primaryNote
							? responseNote
							: (gimmickNote && gimmickNote !== primaryNote ? gimmickNote : undefined);
						const confidence = best?.confidence ?? 'Low';
						const bestName = best ? truncateText(best.pokemon, Math.max(8, activeCardTextWidth - 16)) : '';
						const role = best?.role ? ` (${best.role})` : '';
						const moveLine = best ? `Move ${best.move ?? '(none)'} | Conf ${confidence}` : '';
						const damageLine = `Dmg ${dmgMin}-${dmgMax}% | 2HKO ${formatPercent(twoHkoValue)}`;
						const noteLine = secondaryNote ? `${primaryNote} / ${secondaryNote}` : primaryNote;

						return (
							<Box
								key={enemy}
								width={activeCardWidth}
								height={isExpanded ? expandedCardHeight : cardHeight}
								marginRight={isExpanded || (localIdx + 1) % cardColumns === 0 ? 0 : 1}
								marginBottom={1}
								borderStyle="single"
								borderColor={isSelected ? 'yellow' : 'cyan'}
								paddingX={1}
								flexDirection="column"
							>
								<Text bold color={isSelected ? 'yellow' : 'cyan'} wrap="truncate-end">{isSelected ? `▶ ${truncateText(enemy, Math.max(1, activeCardTextWidth - 2))}` : truncateText(enemy, activeCardTextWidth)}</Text>
								{best ? (
									<>
										<Text color={scoreColor(best.score)} wrap="truncate-end">
											{truncateText(`#1 ${bestName}${best.speedAdvantage ? ' ⚡' : ''}${role}`, activeCardTextWidth)}
										</Text>
										<Text dimColor wrap="truncate-end">{truncateText(moveLine, activeCardTextWidth)}</Text>
										<Text dimColor wrap="truncate-end">
											Score <Text color={scoreColor(best.score)}>{bestScorePct >= 0 ? '+' : ''}{bestScorePct.toFixed(1)}%</Text>{' '}
											{scoreBarColor ? <Text color={scoreBarColor}>[{bestScoreBar}]</Text> : <Text>[{bestScoreBar}]</Text>}
										</Text>
										<Text dimColor wrap="truncate-end">{truncateText(damageLine, activeCardTextWidth)}</Text>
									</>
								) : (
									<Text dimColor wrap="truncate-end">No matchup data.</Text>
								)}
								<Text dimColor wrap="truncate-end">Alts {truncateText(altText || '-', Math.max(1, activeCardTextWidth - 5))}</Text>
								{isExpanded ? null : <Text color="magenta" wrap="truncate-end">Note {truncateText(noteLine, Math.max(1, activeCardTextWidth - 5))}</Text>}
								{isExpanded && best ? (
									<>
										<Text dimColor wrap="truncate-end">{truncateText('────────────────────────────────────────', activeCardTextWidth)}</Text>
										<Text wrap="truncate-end">Details</Text>
										<Text dimColor wrap="truncate-end">1HKO {formatPercent(best.oneHkoChance)} | 2HKO {formatPercent(best.twoHkoChance)} | Speed {best.speedAdvantage ? 'advantage' : 'neutral/disadvantage'}</Text>
										<Text dimColor wrap="truncate-end">Role {best.role ?? 'balanced'} | Confidence {best.confidence ?? 'Low'}</Text>
										<Text wrap="truncate-end">All tactical notes:</Text>
										{(best.notes && best.notes.length > 0 ? best.notes : ['No tactical notes.']).map((note, noteIdx) => {
											const wrapped = wrapText(note, Math.max(8, activeCardTextWidth - 2));
											return (
												<React.Fragment key={`${enemy}-full-note-${noteIdx}`}>
													<Text color="magenta" wrap="truncate-end">• {truncateText(wrapped[0], Math.max(1, activeCardTextWidth - 2))}</Text>
													{wrapped.slice(1).map((line, i) => (
														<Text key={`${enemy}-full-note-${noteIdx}-${i}`} color="magenta" wrap="truncate-end">  {truncateText(line, Math.max(1, activeCardTextWidth - 2))}</Text>
													))}
												</React.Fragment>
											);
										})}
										<Text wrap="truncate-end">Top lines:</Text>
										{picks.slice(0, 3).map((pick, pickIdx) => (
											<Text key={`${enemy}-expanded-pick-${pickIdx}`} dimColor wrap="truncate-end">
												#{pickIdx + 1} {truncateText(pick.pokemon, Math.max(18, Math.floor(activeCardTextWidth * 0.25)))} | {truncateText(pick.move ?? '(none)', Math.max(14, Math.floor(activeCardTextWidth * 0.2)))} | {(pick.score * 100).toFixed(1)}%
											</Text>
										))}
									</>
								) : null}
							</Box>
						);
					})}
				</Box>
			) : <Text dimColor>No results available.</Text>}
			<Box flexGrow={1} />
			<Text dimColor wrap="truncate-end">Arrows: select card | Enter/e: expand | h: fullscreen help | b: back | r: recompute | q/Ctrl+C: quit</Text>
			{error ? <Text color="red" wrap="truncate-end">Error: {error}</Text> : null}
		</Box>
	);
}
