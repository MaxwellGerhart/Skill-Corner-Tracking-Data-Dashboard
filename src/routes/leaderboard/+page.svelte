<script lang="ts">
	import type { PageData } from './$types';
	import { getFilterState, applyFilters } from '../../lib/stores/filters.svelte';
	import { PageShell, FilterBar, MetricSelect, EmptyState, PositionTag, PlayerAvatar } from '#lib';
	import { METRICS, getMetric, type MetricDef } from '../../lib/data/metrics';
	import { formatByUnit } from '../../lib/utils/format';
	import { groupBy, percentileRank } from '../../lib/utils/stats';
	import type { PlayerRecord, PositionGroup } from '../../lib/data/types';

	let { data }: { data: PageData } = $props();
	const filters = getFilterState();

	const filtered = $derived(applyFilters(data.dataset.players, filters));

	let sortKey = $state<string>('dangerousRunsPer30');
	// Horizontal scroll state, so each cut-off edge only fades while there is something hidden past it.
	let scroller = $state<HTMLDivElement>();
	let scrolledX = $state(false);
	let moreRight = $state(false);
	// Header height, so the right-edge fade can switch to the header's surface colour over it.
	let headHeight = $state(0);

	function updateScrollEdges() {
		if (!scroller) return;
		scrolledX = scroller.scrollLeft > 0;
		moreRight = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
	}

	$effect(() => {
		if (!scroller) return;
		updateScrollEdges();
		const observer = new ResizeObserver(updateScrollEdges);
		observer.observe(scroller);
		return () => observer.disconnect();
	});
	let sortDir = $state<'asc' | 'desc'>('desc');

	type SortableColumn = 'player' | 'team' | 'position' | string;

	function toggleSort(key: SortableColumn) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'desc';
		}
	}

	function compareText(a: string, b: string): number {
		return a.localeCompare(b);
	}

	const sorted = $derived.by(() => {
		const list = [...filtered];
		const dir = sortDir === 'asc' ? 1 : -1;
		if (sortKey === 'player' || sortKey === 'team' || sortKey === 'position') {
			list.sort((a, b) => dir * compareText(a[sortKey as 'player' | 'team' | 'position'], b[sortKey as 'player' | 'team' | 'position']));
		} else {
			const metric = getMetric(sortKey);
			list.sort((a, b) => dir * (metric.access(a) - metric.access(b)));
		}
		return list;
	});

	// Percentile within each row's own position group, among the currently filtered pool.
	const percentilesByPosition = $derived.by(() => {
		const groups = groupBy(filtered, (p) => p.position);
		const result = new Map<PositionGroup, Map<string, number[]>>();
		for (const [position, players] of groups) {
			const byMetric = new Map<string, number[]>();
			for (const metric of METRICS) {
				byMetric.set(metric.key, players.map((p) => metric.access(p)));
			}
			result.set(position, byMetric);
		}
		return result;
	});

	function cellPercentile(player: PlayerRecord, metric: MetricDef): number {
		const values = percentilesByPosition.get(player.position)?.get(metric.key);
		if (!values) return NaN;
		return percentileRank(metric.access(player), values);
	}

	function shadeStyle(pct: number): string {
		if (!Number.isFinite(pct)) return '';
		// Diverges from the position-group median (50th percentile): below it shades red,
		// above it shades green, scaling with distance from the midpoint.
		const color = pct >= 50 ? 'var(--color-good)' : 'var(--color-critical)';
		const intensity = Math.round((Math.abs(pct - 50) / 50) * 35);
		return `background-color: color-mix(in srgb, ${color} ${intensity}%, var(--color-bg-raised))`;
	}
</script>

<svelte:head>
	<title>Leaderboard — SkillCorner</title>
</svelte:head>

<PageShell
	eyebrow="Compare"
	title="Leaderboard"
	subtitle="Every metric is shaded by percentile within the player's own position group, so a centre-back and a winger are never compared on the same scale. Click a column header, or use the picker, to sort."
>
	<FilterBar dataset={data.dataset} />

	<div class="flex flex-wrap items-end gap-4">
		<MetricSelect bind:value={sortKey} options={METRICS} label="Sort by" />
		<button
			type="button"
			onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
			class="cursor-pointer border border-border bg-bg-raised px-3 py-2 text-xs tracking-[0.08em] text-fg-soft uppercase hover:border-fg-soft hover:text-fg"
		>
			{sortDir === 'desc' ? 'Descending ↓' : 'Ascending ↑'}
		</button>
		<span class="text-xs text-fg-faint">{sorted.length} player-positions</span>
	</div>

	{#if sorted.length === 0}
		<EmptyState />
	{:else}
		<div class="relative border border-border bg-bg-raised">
		<div bind:this={scroller} class="overflow-x-auto" onscroll={updateScrollEdges}>
			<table class="w-full min-w-240 border-collapse text-sm">
				<thead bind:clientHeight={headHeight}>
					<tr class="sticky top-0 z-10 border-b border-border bg-bg-sunken text-left text-xs text-fg-faint uppercase">
						<th class="frozen-col sticky left-0 z-20 bg-bg-sunken px-4 py-2.5 font-medium" class:scrolled={scrolledX}>
							<button type="button" class="cursor-pointer bg-transparent p-0 text-xs uppercase hover:text-fg" onclick={() => toggleSort('player')}>
								Player {sortKey === 'player' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
							</button>
						</th>
						<th class="px-4 py-2.5 font-medium">
							<button type="button" class="cursor-pointer bg-transparent p-0 text-xs uppercase hover:text-fg" onclick={() => toggleSort('team')}>
								Team {sortKey === 'team' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
							</button>
						</th>
						<th class="px-4 py-2.5 font-medium">
							<button type="button" class="cursor-pointer bg-transparent p-0 text-xs uppercase hover:text-fg" onclick={() => toggleSort('position')}>
								Position {sortKey === 'position' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
							</button>
						</th>
						{#each METRICS as metric (metric.key)}
							<th class="px-4 py-2.5 text-right font-medium">
								<button
									type="button"
									class="cursor-pointer bg-transparent p-0 text-xs whitespace-nowrap uppercase hover:text-fg"
									onclick={() => toggleSort(metric.key)}
								>
									{metric.shortLabel} {sortKey === metric.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sorted as player (player.id)}
						<tr class="border-b border-border last:border-b-0">
							<td class="frozen-col sticky left-0 z-10 bg-bg-raised px-4 py-2.5 whitespace-nowrap" class:scrolled={scrolledX}>
								<span class="flex items-center gap-2">
									<PlayerAvatar playerId={player.playerId} name={player.player} hasHeadshot={player.hasHeadshot} size={28} />
									<a href="/players/{player.id}" class="font-medium text-fg hover:text-accent-ink">{player.player}</a>
								</span>
							</td>
							<td class="px-4 py-2.5 whitespace-nowrap text-fg-soft">{player.team}</td>
							<td class="px-4 py-2.5 whitespace-nowrap"><PositionTag position={player.position} /></td>
							{#each METRICS as metric (metric.key)}
								<td class="px-4 py-2.5 text-right font-mono tabular-nums" style={shadeStyle(cellPercentile(player, metric))}>
									{formatByUnit(metric.access(player), metric.unit)}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="edge-fade" class:visible={moreRight} style="--head-h: {headHeight}px" aria-hidden="true"></div>
		</div>
	{/if}
</PageShell>

<style>
	/* A divider on the frozen column's right edge (a shadow rather than a border, since
	   borders on sticky cells in a collapsed table scroll away with the body). */
	.frozen-col {
		box-shadow: inset -1px 0 0 var(--color-border);
	}

	/* Fade + light blur over columns that are cut off: just past the frozen column once the
	   metrics are scrolled under it, and along the right edge while more columns remain. The
	   blur is masked so it ramps in with the fade instead of starting as a hard band. */
	.frozen-col::after,
	.edge-fade {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1.25rem;
		pointer-events: none;
		opacity: 0;
		transition: opacity 150ms ease;
		backdrop-filter: blur(0.5px);
	}
	.frozen-col::after {
		left: 100%;
		background: linear-gradient(to right, color-mix(in srgb, var(--fade-from) 60%, transparent), transparent);
		mask-image: linear-gradient(to right, black, transparent);
	}
	th.frozen-col {
		--fade-from: var(--color-bg-sunken);
	}
	td.frozen-col {
		--fade-from: var(--color-bg-raised);
	}
	.frozen-col.scrolled::after {
		opacity: 1;
	}
	.edge-fade {
		right: 0;
		width: 2rem;
		/* Above the sticky header row (z-20), with the header strip faded in its own colour. */
		z-index: 30;
		background:
			linear-gradient(to left, color-mix(in srgb, var(--color-bg-sunken) 60%, transparent), transparent) top / 100% var(--head-h) no-repeat,
			linear-gradient(to left, color-mix(in srgb, var(--color-bg-raised) 60%, transparent), transparent) 0 var(--head-h) / 100% calc(100% - var(--head-h)) no-repeat;
		mask-image: linear-gradient(to left, black, transparent);
	}
	.edge-fade.visible {
		opacity: 1;
	}
</style>
