<script lang="ts">
	import Marker from './Marker.svelte';
	import { POSITION_SHAPE, positionColorVar } from '../utils/positions';
	import { formatByUnit } from '../utils/format';
	import type { MetricUnit } from '../data/metrics';
	import type { PositionGroup } from '../data/types';

	let {
		items,
		unit
	}: {
		items: { position: PositionGroup; value: number }[];
		unit: MetricUnit;
	} = $props();

	const maxValue = $derived(Math.max(...items.map((i) => i.value), 0.0001));
</script>

<div class="grid gap-3">
	{#each items as item (item.position)}
		<div class="grid grid-cols-[140px_1fr_56px] items-center gap-3 sm:grid-cols-[160px_1fr_64px]">
			<span class="flex items-center gap-1.5 truncate text-xs text-fg-soft">
				<svg width="9" height="9" viewBox="-6 -6 12 12" class="shrink-0" aria-hidden="true">
					<Marker shape={POSITION_SHAPE[item.position]} color={positionColorVar(item.position)} size={9} />
				</svg>
				<span class="truncate">{item.position}</span>
			</span>
			<div class="h-4 w-full bg-bg-sunken">
				<div
					class="h-full"
					style="width: {(item.value / maxValue) * 100}%; background: {positionColorVar(item.position)}"
				></div>
			</div>
			<span class="text-right font-mono text-xs font-medium text-fg tabular-nums">{formatByUnit(item.value, unit)}</span>
		</div>
	{/each}
</div>
