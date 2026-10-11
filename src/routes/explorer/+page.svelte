<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getFilterState, applyFilters } from '../../lib/stores/filters.svelte';
	import { PageShell, FilterBar, MetricSelect, EmptyState, PositionLegend, ScatterChart } from '#lib';
	import { METRICS, getMetric } from '../../lib/data/metrics';
	import { POSITION_ORDER } from '../../lib/utils/positions';

	let { data }: { data: PageData } = $props();
	const filters = getFilterState();

	const filtered = $derived(applyFilters(data.dataset.players, filters));
	const presentPositions = $derived(POSITION_ORDER.filter((pos) => filtered.some((p) => p.position === pos)));

	let xKey = $state('runsPer30');
	let yKey = $state('pctDangerous');

	const points = $derived.by(() => {
		const xMetric = getMetric(xKey);
		const yMetric = getMetric(yKey);
		return filtered.map((p) => ({
			id: p.id,
			x: xMetric.access(p),
			y: yMetric.access(p),
			position: p.position,
			label: p.player,
			sublabel: `${p.team} · ${p.position}`
		}));
	});
</script>

<svelte:head>
	<title>Explorer — SkillCorner</title>
</svelte:head>

<PageShell
	eyebrow="Visualize"
	title="Explorer"
	subtitle="Each point is one player in one position. Shape carries position identity (colour is a supporting cue only, since five position groups is more than colour alone can safely separate) — hover a point for details, click to open that player's profile."
>
	<FilterBar dataset={data.dataset} />

	<div class="flex flex-wrap items-end gap-4">
		<MetricSelect bind:value={xKey} options={METRICS} label="X axis" />
		<MetricSelect bind:value={yKey} options={METRICS} label="Y axis" />
	</div>

	{#if points.length === 0}
		<EmptyState />
	{:else}
		<div class="grid gap-4 border border-border bg-bg-raised p-4 sm:p-6">
			<PositionLegend positions={presentPositions} />
			<ScatterChart
				{points}
				xLabel={getMetric(xKey).label}
				yLabel={getMetric(yKey).label}
				xUnit={getMetric(xKey).unit}
				yUnit={getMetric(yKey).unit}
				onSelect={(id) => goto(`/players/${id}`)}
			/>
		</div>
		<p class="text-xs text-fg-faint">
			Prefer a table? The <a href="/leaderboard" class="text-accent-ink hover:text-fg">Leaderboard</a> shows every player and
			metric as text.
		</p>
	{/if}
</PageShell>
