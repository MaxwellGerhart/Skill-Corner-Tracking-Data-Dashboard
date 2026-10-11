<script lang="ts">
	import { formatByUnit } from '../utils/format';
	import type { MetricUnit } from '../data/metrics';
	import { percentileColor } from '../utils/percentileColor';

	let {
		label,
		value,
		unit,
		percentile
	}: {
		label: string;
		value: number;
		unit: MetricUnit;
		percentile: number;
	} = $props();

	function ordinal(n: number): string {
		const rounded = Math.round(n);
		const mod100 = rounded % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
		switch (rounded % 10) {
			case 1:
				return `${rounded}st`;
			case 2:
				return `${rounded}nd`;
			case 3:
				return `${rounded}rd`;
			default:
				return `${rounded}th`;
		}
	}
</script>

<div class="grid gap-1.5">
	<div class="flex items-baseline justify-between gap-3 text-sm">
		<span class="text-fg-soft">{label}</span>
		<span class="font-mono font-medium text-fg tabular-nums">{formatByUnit(value, unit)}</span>
	</div>
	<div class="h-2 w-full bg-bg-sunken">
		<div
			class="h-full"
			style="width: {Number.isFinite(percentile) ? percentile : 0}%; background: {percentileColor(percentile)}"
		></div>
	</div>
	<span class="text-[11px] text-fg-faint">
		{Number.isFinite(percentile) ? `${ordinal(percentile)} percentile for position` : 'Not enough data'}
	</span>
</div>
