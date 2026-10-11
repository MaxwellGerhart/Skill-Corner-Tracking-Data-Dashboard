<script lang="ts">
	import Marker from './Marker.svelte';
	import { POSITION_ORDER, POSITION_SHAPE, positionColorVar } from '../utils/positions';
	import type { PositionGroup } from '../data/types';

	let { positions = POSITION_ORDER }: { positions?: PositionGroup[] } = $props();
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-soft">
	{#each positions as position (position)}
		<span class="inline-flex items-center gap-1.5">
			<!-- Same outlined marker as the scatter points, so the key matches the plot. -->
			<svg width="12" height="12" viewBox="-7 -7 14 14" aria-hidden="true">
				<Marker shape={POSITION_SHAPE[position]} color={positionColorVar(position)} size={9} outline="var(--color-fg)" />
			</svg>
			{position}
		</span>
	{/each}
</div>
