<script lang="ts">
	import ChartTooltip from './ChartTooltip.svelte';
	import Marker from './Marker.svelte';
	import { POSITION_SHAPE, positionColorVar } from '../utils/positions';
	import { niceTicks } from '../utils/ticks';
	import { formatByUnit } from '../utils/format';
	import type { MetricUnit } from '../data/metrics';
	import type { PositionGroup } from '../data/types';

	export interface ScatterPoint {
		id: string;
		x: number;
		y: number;
		position: PositionGroup;
		label: string;
		sublabel: string;
	}

	let {
		points,
		xLabel,
		yLabel,
		xUnit,
		yUnit,
		onSelect
	}: {
		points: ScatterPoint[];
		xLabel: string;
		yLabel: string;
		xUnit: MetricUnit;
		yUnit: MetricUnit;
		onSelect?: (id: string) => void;
	} = $props();

	const VIEW_W = 640;
	const VIEW_H = 400;
	const PAD = { top: 16, right: 20, bottom: 44, left: 56 };

	function domain(values: number[]): [number, number] {
		if (values.length === 0) return [0, 1];
		const min = Math.min(...values);
		const max = Math.max(...values);
		if (min === max) return [min - 1, max + 1];
		const pad = (max - min) * 0.08;
		return [Math.max(0, min - pad), max + pad];
	}

	const xDomain = $derived(domain(points.map((p) => p.x)));
	const yDomain = $derived(domain(points.map((p) => p.y)));

	function scaleX(v: number): number {
		const [min, max] = xDomain;
		return PAD.left + ((v - min) / (max - min)) * (VIEW_W - PAD.left - PAD.right);
	}
	function scaleY(v: number): number {
		const [min, max] = yDomain;
		return VIEW_H - PAD.bottom - ((v - min) / (max - min)) * (VIEW_H - PAD.top - PAD.bottom);
	}

	const xTicks = $derived(niceTicks(xDomain[0], xDomain[1], 5));
	const yTicks = $derived(niceTicks(yDomain[0], yDomain[1], 5));

	const renderPoints = $derived(points.map((p) => ({ ...p, cx: scaleX(p.x), cy: scaleY(p.y) })));

	let svgEl: SVGSVGElement;
	let wrapperEl: HTMLDivElement;
	let hoveredId = $state<string | null>(null);
	let tooltipPos = $state<{ x: number; y: number } | null>(null);

	const hovered = $derived(renderPoints.find((p) => p.id === hoveredId) ?? null);
	// The last hovered point stays as the tooltip's content while it fades out.
	let shown = $state<(typeof renderPoints)[number] | null>(null);
	$effect(() => {
		if (hovered) shown = hovered;
	});

	function handlePointerMove(e: PointerEvent) {
		if (!svgEl || !wrapperEl) return;
		const ctm = svgEl.getScreenCTM();
		if (!ctm) return;
		const pt = svgEl.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const svgP = pt.matrixTransform(ctm.inverse());

		let nearest: (typeof renderPoints)[number] | null = null;
		let nearestDistSq = Infinity;
		for (const p of renderPoints) {
			const dx = p.cx - svgP.x;
			const dy = p.cy - svgP.y;
			const d = dx * dx + dy * dy;
			if (d < nearestDistSq) {
				nearestDistSq = d;
				nearest = p;
			}
		}

		const hitRadiusUser = 24 / ctm.a;
		if (nearest && nearestDistSq <= hitRadiusUser * hitRadiusUser) {
			hoveredId = nearest.id;
			// Anchor to the point itself (not the cursor), so the tooltip glides from point
			// to point as the hover moves across the cloud.
			const wrapperRect = wrapperEl.getBoundingClientRect();
			tooltipPos = {
				x: ctm.a * nearest.cx + ctm.e - wrapperRect.left,
				y: ctm.d * nearest.cy + ctm.f - wrapperRect.top
			};
		} else {
			hoveredId = null;
		}
	}

	function handleLeave() {
		hoveredId = null;
	}

	function handleClick() {
		if (hoveredId) onSelect?.(hoveredId);
	}
</script>

<div class="relative" bind:this={wrapperEl}>
	<!--
		Mouse/pointer-first chart interaction. The Leaderboard page is the full
		keyboard- and screen-reader-accessible table view of the same data (see
		the dataviz skill's interaction guidance: tooltips enhance, they never gate).
	-->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={svgEl}
		viewBox="0 0 {VIEW_W} {VIEW_H}"
		class="h-auto w-full cursor-crosshair touch-none select-none"
		role="img"
		aria-label="{xLabel} versus {yLabel}, one point per player"
		onpointermove={handlePointerMove}
		onpointerleave={handleLeave}
		onclick={handleClick}
	>
		{#each yTicks as t (t)}
			<line x1={PAD.left} x2={VIEW_W - PAD.right} y1={scaleY(t)} y2={scaleY(t)} stroke="var(--color-border)" stroke-width="1" />
			<text x={PAD.left - 8} y={scaleY(t)} text-anchor="end" dominant-baseline="middle" class="fill-fg-faint" style="font-size:10px; font-family:var(--font-mono)"
				>{formatByUnit(t, yUnit)}</text
			>
		{/each}
		{#each xTicks as t (t)}
			<text x={scaleX(t)} y={VIEW_H - PAD.bottom + 18} text-anchor="middle" class="fill-fg-faint" style="font-size:10px; font-family:var(--font-mono)"
				>{formatByUnit(t, xUnit)}</text
			>
		{/each}
		<line
			x1={PAD.left}
			x2={VIEW_W - PAD.right}
			y1={VIEW_H - PAD.bottom}
			y2={VIEW_H - PAD.bottom}
			stroke="var(--color-border)"
			stroke-width="1"
		/>

		<text x={(PAD.left + VIEW_W - PAD.right) / 2} y={VIEW_H - 6} text-anchor="middle" class="fill-fg-soft" style="font-size:11px"
			>{xLabel}</text
		>
		<text
			transform="translate(14 {(PAD.top + VIEW_H - PAD.bottom) / 2}) rotate(-90)"
			text-anchor="middle"
			class="fill-fg-soft"
			style="font-size:11px"
		>
			{yLabel}
		</text>

		{#each renderPoints as p (p.id)}
			{@const isHovered = hoveredId === p.id}
			{@const dimmed = hoveredId !== null && !isHovered}
			<g transform="translate({p.cx} {p.cy})" opacity={dimmed ? 0.3 : 1}>
				<!-- Each point is a "sticker": a surface-coloured halo and a text-coloured outline,
				     both following the marker's shape, so overlapping points stack cleanly and pale
				     or very dark position colours keep a visible edge in either theme. -->
				<Marker
					shape={POSITION_SHAPE[p.position]}
					color={positionColorVar(p.position)}
					size={isHovered ? 11 : 9}
					outline="var(--color-fg)"
					outlineWidth={0.6}
					outlineOpacity={1}
					halo="var(--color-bg-raised)"
					haloWidth={1}
				/>
			</g>
		{/each}
	</svg>

	<ChartTooltip open={hovered !== null} x={tooltipPos?.x ?? 0} y={tooltipPos?.y ?? 0}>
		{#if shown}
			<div class="min-w-44">
				<div class="font-medium text-fg">{shown.label}</div>
				<div class="text-fg-faint">{shown.sublabel}</div>
				<div class="mt-1.5 flex justify-between gap-4">
					<span class="text-fg-soft">{xLabel}</span>
					<span class="font-mono font-medium text-fg tabular-nums">{formatByUnit(shown.x, xUnit)}</span>
				</div>
				<div class="flex justify-between gap-4">
					<span class="text-fg-soft">{yLabel}</span>
					<span class="font-mono font-medium text-fg tabular-nums">{formatByUnit(shown.y, yUnit)}</span>
				</div>
				<div class="mt-1.5 text-[11px] text-accent-ink">Click to open profile →</div>
			</div>
		{/if}
	</ChartTooltip>
</div>
