<script lang="ts">
	import { formatByUnit } from '../utils/format';
	import type { MetricUnit } from '../data/metrics';
	import { percentileColor } from '../utils/percentileColor';

	let {
		label,
		value,
		median,
		percentile,
		unit
	}: {
		label: string;
		value: number;
		median: number;
		/** Percentile within the position group: sets the bar's length and colour. */
		percentile: number;
		unit: MetricUnit;
	} = $props();

	const width = $derived(Number.isFinite(percentile) ? percentile : 0);
</script>

<div class="grid grid-cols-[150px_1fr_52px] items-center gap-3 sm:grid-cols-[170px_1fr_60px]">
	<span class="truncate text-xs text-fg-soft">{label}</span>
	<div class="relative h-4 w-full bg-bg-sunken" title={`${Math.round(width)}th percentile · position median ${formatByUnit(median, unit)}`}>
		<!-- min-width keeps a bottom-band bar visible, so its colour still reads. -->
		<div class="h-full min-w-[3px]" style="width: {width}%; background: {percentileColor(percentile)}"></div>
		<!-- The position median is the 50th percentile by definition. -->
		<div class="absolute top-0 left-1/2 h-full w-0.5 bg-fg"></div>
	</div>
	<span class="text-right font-mono text-xs font-medium text-fg tabular-nums">{formatByUnit(value, unit)}</span>
</div>
