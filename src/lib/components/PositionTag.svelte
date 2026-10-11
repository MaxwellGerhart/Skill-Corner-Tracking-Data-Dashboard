<script lang="ts">
	import Marker from './Marker.svelte';
	import { POSITION_SHAPE, positionColorVar } from '../utils/positions';
	import type { PositionGroup } from '../data/types';

	let { position }: { position: PositionGroup } = $props();
</script>

<span class="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-soft">
	<svg width="10" height="10" viewBox="-6 -6 12 12" aria-hidden="true">
		<Marker shape={POSITION_SHAPE[position]} color={positionColorVar(position)} size={9} />
	</svg>
	{position}
</span>
