<script lang="ts">
	import { formatByUnit, formatPct } from '../utils/format';
	import type { MetricUnit } from '../data/metrics';
	import { percentileColor } from '../utils/percentileColor';

	let {
		steps,
		unit
	}: {
		/** percentile: within the position group; sets the step bar's length and colour. */
		steps: { label: string; value: number; percentile: number }[];
		unit: MetricUnit;
	} = $props();
</script>

<div class="grid gap-0">
	{#each steps as step, i (step.label)}
		{#if i > 0}
			<div class="flex items-center gap-2 py-1 pl-1 text-[11px] text-fg-faint">
				<span aria-hidden="true" class="text-accent-ink">↓</span>
				{formatPct((step.value / (steps[i - 1].value || 1)) * 100)} of "{steps[i - 1].label}"
			</div>
		{/if}
		<div class="grid gap-1">
			<div class="flex items-baseline justify-between text-xs">
				<span class="text-fg-soft">{step.label}</span>
				<span class="font-mono font-medium text-fg tabular-nums">{formatByUnit(step.value, unit)}</span>
			</div>
			<div class="relative h-5 w-full bg-bg-sunken" title={`${Math.round(step.percentile)}th percentile for position`}>
				<!-- min-width keeps a bottom-band bar visible, so its colour still reads. -->
				<div
					class="h-full min-w-[3px]"
					style="width: {Number.isFinite(step.percentile) ? step.percentile : 0}%; background: {percentileColor(step.percentile)}"
				></div>
				<!-- Position median (50th percentile). -->
				<div class="absolute top-0 left-1/2 h-full w-0.5 bg-fg"></div>
			</div>
		</div>
	{/each}
</div>
