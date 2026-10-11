/** Lower bound of each percentile band. */
export const PERCENTILE_BANDS = [0, 20, 40, 60, 80] as const;

/**
 * One colour per band, from layout.css. Spelled out in full (not built as `--color-pct-${n}`)
 * because Tailwind v4 only emits @theme variables whose full names appear in source.
 */
const BAND_COLORS = [
	'var(--color-pct-1)',
	'var(--color-pct-2)',
	'var(--color-pct-3)',
	'var(--color-pct-4)',
	'var(--color-pct-5)'
] as const;

/** 1-5: which 20-percentile band a value falls in within the player's position group. */
export function percentileBand(pct: number): number {
	return Math.min(5, Math.max(1, Math.floor(pct / 20) + 1));
}

/**
 * Bar colour for a percentile within the player's position group: five fixed bands from
 * red (bottom fifth) through a muted middle to bright green (top fifth), so good and bad
 * read at a glance rather than as fine gradations.
 */
export function percentileColor(pct: number): string {
	if (!Number.isFinite(pct)) return 'var(--color-fg-faint)';
	return BAND_COLORS[percentileBand(pct) - 1];
}
