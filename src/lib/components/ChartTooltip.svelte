<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { SPRING_FOLLOW, pop, reduceMotion } from '../utils/motion';

	/*
	 * Floating tooltip for charts and tables. Adapted from beUI's tooltip
	 * (github.com/starc007/ui-components, MIT): it pops in with a quick fade and scale,
	 * then glides on a spring as its anchor moves (between points, or between cells)
	 * instead of jumping. Place it inside a `position: relative` container and pass the
	 * anchor in that container's coordinates.
	 *
	 * - placement "cursor": sits below-right of the anchor, flipping left near the edge.
	 * - placement "above": centred above the anchor (e.g. the top-centre of a cell).
	 */
	let {
		x,
		y,
		open,
		placement = 'cursor',
		children
	}: {
		x: number;
		y: number;
		open: boolean;
		placement?: 'cursor' | 'above';
		children: Snippet;
	} = $props();

	const GAP = 12;
	let box = $state<HTMLDivElement>();
	let width = $state(0);
	let height = $state(0);

	const pos = new Spring({ x: 0, y: 0 }, SPRING_FOLLOW);
	// When it last opened: placements in the first moments snap (including the re-place
	// once its own size is measured), so it never slides in from a stale spot.
	let openedAt = 0;
	$effect(() => {
		if (open) openedAt = performance.now();
	});

	const target = $derived.by(() => {
		const bounds = box?.offsetParent as HTMLElement | null;
		const maxX = (bounds?.clientWidth ?? Infinity) - width;
		if (placement === 'above') {
			return { x: Math.max(0, Math.min(maxX, x - width / 2)), y: y - height - 8 };
		}
		const right = x + GAP;
		return { x: right > maxX ? Math.max(0, x - GAP - width) : right, y: Math.max(0, y + GAP) };
	});

	$effect(() => {
		const next = target;
		pos.set(next, { instant: performance.now() - openedAt < 60 || reduceMotion() });
	});
</script>

{#if open}
	<div
		bind:this={box}
		bind:clientWidth={width}
		bind:clientHeight={height}
		class="pointer-events-none absolute top-0 left-0 z-40"
		style="transform: translate({pos.current.x}px, {pos.current.y}px)"
	>
		<div
			role="tooltip"
			transition:pop={{ duration: 160 }}
			class="border border-border bg-bg-raised px-3 py-2 text-xs whitespace-nowrap shadow-lg"
			style="transform-origin: {placement === 'above' ? 'bottom center' : 'top left'}"
		>
			{@render children()}
		</div>
	</div>
{/if}
