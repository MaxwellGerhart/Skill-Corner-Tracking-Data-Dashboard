<script lang="ts">
	import type { MarkerShape } from '../utils/positions';

	let {
		shape,
		color,
		size = 9,
		opacity = 1,
		outline,
		outlineWidth = 1.2,
		outlineOpacity = 0.7,
		halo,
		haloWidth = 2
	}: {
		shape: MarkerShape;
		color: string;
		size?: number;
		opacity?: number;
		/** Stroke colour for an outline that follows the marker's own shape. */
		outline?: string;
		outlineWidth?: number;
		outlineOpacity?: number;
		/**
		 * Colour of a ring outside the outline, also following the shape (usually the chart
		 * surface). Drawn first, so overlapping markers stack like stickers: each one cuts a
		 * shape-shaped gap in whatever it covers.
		 */
		halo?: string;
		haloWidth?: number;
	} = $props();

	const r = $derived(size / 2);
	const crossWidth = $derived(Math.max(2, size * 0.28));
	const ring = $derived((outline ? outlineWidth : 0) + 2 * haloWidth);
	const outlineStroke = $derived(
		outline ? { stroke: outline, 'stroke-width': outlineWidth, 'stroke-opacity': outlineOpacity, 'stroke-linejoin': 'round' as const } : {}
	);
</script>

{#snippet filled(fill: string, fillOpacity: number, stroke: Record<string, unknown>)}
	{#if shape === 'circle'}
		<circle cx="0" cy="0" r={r} {fill} fill-opacity={fillOpacity} {...stroke} />
	{:else if shape === 'square'}
		<rect x={-r} y={-r} width={size} height={size} {fill} fill-opacity={fillOpacity} {...stroke} />
	{:else if shape === 'triangle'}
		<polygon points="0,{-r} {r},{r} {-r},{r}" {fill} fill-opacity={fillOpacity} {...stroke} />
	{:else}
		<polygon points="0,{-r} {r},0 0,{r} {-r},0" {fill} fill-opacity={fillOpacity} {...stroke} />
	{/if}
{/snippet}

{#snippet cross(stroke: string, width: number, strokeOpacity: number)}
	<g {stroke} stroke-opacity={strokeOpacity} stroke-width={width} stroke-linecap="round">
		<line x1={-r} y1="0" x2={r} y2="0" />
		<line x1="0" y1={-r} x2="0" y2={r} />
	</g>
{/snippet}

{#if shape === 'cross'}
	<!-- The cross is stroked, so its halo and outline are progressively wider copies underneath. -->
	{#if halo}{@render cross(halo, crossWidth + 2 * ((outline ? outlineWidth : 0) + haloWidth), 1)}{/if}
	{#if outline}{@render cross(outline, crossWidth + 2 * outlineWidth, outlineOpacity)}{/if}
	{@render cross(color, crossWidth, opacity)}
{:else}
	{#if halo}{@render filled(halo, 1, { stroke: halo, 'stroke-width': ring, 'stroke-linejoin': 'round' })}{/if}
	{@render filled(color, opacity, outlineStroke)}
{/if}
