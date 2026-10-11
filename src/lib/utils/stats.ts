export function median(values: number[]): number {
	if (values.length === 0) return NaN;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mean(values: number[]): number {
	if (values.length === 0) return NaN;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Weighted mean, e.g. averaging a rate across players while weighting by sample size. */
export function weightedMean(values: number[], weights: number[]): number {
	let num = 0;
	let den = 0;
	for (let i = 0; i < values.length; i++) {
		num += values[i] * weights[i];
		den += weights[i];
	}
	return den === 0 ? NaN : num / den;
}

/**
 * Mid-rank percentile (0-100): share of `values` below `value`, plus half of those tied
 * with it. Counting ties as half keeps a common value (e.g. the many players with zero
 * overlap runs) near the middle instead of ranking it as if it beat everyone tied with it.
 */
export function percentileRank(value: number, values: number[]): number {
	if (values.length === 0) return NaN;
	let below = 0;
	let tied = 0;
	for (const v of values) {
		if (v < value) below++;
		else if (v === value) tied++;
	}
	return ((below + tied / 2) / values.length) * 100;
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of items) {
		const k = key(item);
		const group = groups.get(k);
		if (group) group.push(item);
		else groups.set(k, [item]);
	}
	return groups;
}

export function sum(values: number[]): number {
	return values.reduce((s, v) => s + v, 0);
}
