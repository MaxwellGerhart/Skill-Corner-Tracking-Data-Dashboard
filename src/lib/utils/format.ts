import type { MetricUnit } from '../data/metrics';

export function formatByUnit(value: number, unit: MetricUnit): string {
	if (!Number.isFinite(value)) return '—';
	switch (unit) {
		case 'pct':
			return `${value.toFixed(1)}%`;
		case 'per30':
			return value.toFixed(1);
		case 'm':
			return `${value.toFixed(1)} m`;
		case 'minutes':
			return `${value.toFixed(0)} min`;
		case 'matches':
		case 'count':
			return Math.round(value).toLocaleString('en-AU');
		default:
			return value.toFixed(1);
	}
}

export function formatRate(value: number): string {
	return Number.isFinite(value) ? value.toFixed(1) : '—';
}

export function formatPct(value: number): string {
	return Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
}

export function formatInt(value: number): string {
	return Number.isFinite(value) ? Math.round(value).toLocaleString('en-AU') : '—';
}
