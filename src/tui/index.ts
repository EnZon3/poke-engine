import React from 'react';
import { render } from 'ink';
import type { TuiDefaults } from '../interactive.js';
import { InkTuiApp } from './ui.js';

export async function runInkTUI(defaults: TuiDefaults = {}): Promise<void> {
	const app = render(React.createElement(InkTuiApp, { defaults }));
	await app.waitUntilExit();
}
