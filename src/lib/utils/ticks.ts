/** Rounds a step up to a "nice" 1/2/5 * 10^n value, then returns ticks spanning [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
	if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
	const range = max - min;
	const rawStep = range / count;
	const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
	const residual = rawStep / magnitude;

	let step: number;
	if (residual > 5) step = 10 * magnitude;
	else if (residual > 2) step = 5 * magnitude;
	else if (residual > 1) step = 2 * magnitude;
	else step = magnitude;

	const ticks: number[] = [];
	const first = Math.ceil(min / step) * step;
	for (let v = first; v <= max + step * 1e-6; v += step) {
		ticks.push(Number(v.toFixed(10)));
	}
	return ticks;
}
