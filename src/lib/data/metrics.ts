import type { PlayerRecord } from './types';

export type MetricUnit = 'per30' | 'pct' | 'm' | 'count' | 'matches' | 'minutes';

export interface MetricDef {
	key: string;
	label: string;
	shortLabel: string;
	unit: MetricUnit;
	description: string;
	access: (p: PlayerRecord) => number;
	/** Whether a higher value is the "better"/more-notable one, for percentile shading direction. Default true. */
	higherIsBetter?: boolean;
}

export const METRICS: MetricDef[] = [
	{
		key: 'runsPer30',
		label: 'Runs per 30',
		shortLabel: 'Runs/30',
		unit: 'per30',
		description: 'All off-ball runs, of any type, per 30 minutes of team possession. How often a player moves.',
		access: (p) => p.runsPer30
	},
	{
		key: 'dangerousRunsPer30',
		label: 'Dangerous runs per 30',
		shortLabel: 'Dangerous/30',
		unit: 'per30',
		description: 'Runs per 30 minutes of possession that SkillCorner rated dangerous. How often a player moves somewhere valuable.',
		access: (p) => p.dangerousRunsPer30
	},
	{
		key: 'pctDangerous',
		label: '% of runs dangerous',
		shortLabel: '% dangerous',
		unit: 'pct',
		description: 'Share of a player\'s runs rated dangerous. The quality of their movement, independent of volume.',
		access: (p) => p.pctDangerous
	},
	{
		key: 'pctPassedTo',
		label: '% of runs passed to',
		shortLabel: '% passed to',
		unit: 'pct',
		description: "Share of a player's runs where a teammate on the ball passed to them, whether or not it arrived.",
		access: (p) => p.pctPassedTo
	},
	{
		key: 'pctReceived',
		label: '% of runs received',
		shortLabel: '% received',
		unit: 'pct',
		description: "Share of a player's runs where they actually received the ball.",
		access: (p) => p.pctReceived
	},
	{
		key: 'runsInBehindPer30',
		label: 'Runs in behind per 30',
		shortLabel: 'In behind/30',
		unit: 'per30',
		description: 'Runs beyond the last line of defenders, per 30 minutes of possession — a strong signal for attacking threat.',
		access: (p) => p.runsInBehindPer30
	},
	{
		key: 'highSpeedRunsPer30',
		label: 'High-speed runs per 30',
		shortLabel: 'High-speed/30',
		unit: 'per30',
		description: 'Runs made above the high-speed-running threshold, per 30 minutes of possession.',
		access: (p) => p.highSpeedRunsPer30
	},
	{
		key: 'avgRunLengthM',
		label: 'Average run length',
		shortLabel: 'Avg length',
		unit: 'm',
		description: 'Average distance covered per run, in metres, across every run type.',
		access: (p) => p.avgRunLengthM
	},
	{
		key: 'matches',
		label: 'Matches',
		shortLabel: 'Matches',
		unit: 'matches',
		description: 'Matches counted for this player in this position, after the minimum-matches cleaning rule.',
		access: (p) => p.matches
	},
	{
		key: 'totalRuns',
		label: 'Total runs',
		shortLabel: 'Total runs',
		unit: 'count',
		description: 'The raw count of every off-ball run across those matches — not normalised for possession.',
		access: (p) => p.totalRuns
	}
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export function getMetric(key: string): MetricDef {
	const metric = METRIC_BY_KEY[key];
	if (!metric) throw new Error(`Unknown metric: ${key}`);
	return metric;
}
