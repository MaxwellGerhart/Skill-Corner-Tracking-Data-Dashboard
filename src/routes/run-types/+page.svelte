<script lang="ts">
	import type { PageData } from './$types';
	import { getFilterState, applyFilters } from '../../lib/stores/filters.svelte';
	import { PageShell, FilterBar, EmptyState, PositionBarList, PositionTag } from '#lib';
	import { RUN_TYPE_DEFINITIONS } from '../../lib/data/runTypes';
	import { groupBy, median, weightedMean } from '../../lib/utils/stats';
	import { formatPct, formatRate } from '../../lib/utils/format';
	import { POSITION_ORDER } from '../../lib/utils/positions';
	import type { RunTypeKey } from '../../lib/data/types';

	let { data }: { data: PageData } = $props();
	const filters = getFilterState();

	const filtered = $derived(applyFilters(data.dataset.players, filters));

	const cards = $derived.by(() => {
		return RUN_TYPE_DEFINITIONS.map((def) => {
			const active = filtered.filter((p) => p.runTypes[def.key].countPer30 > 0);

			const groups = groupBy(filtered, (p) => p.position);
			const byPosition = POSITION_ORDER.filter((pos) => groups.has(pos)).map((pos) => ({
				position: pos,
				value: median((groups.get(pos) ?? []).map((p) => p.runTypes[def.key as RunTypeKey].countPer30))
			}));

			const topPlayers = [...active]
				.sort((a, b) => b.runTypes[def.key].countPer30 - a.runTypes[def.key].countPer30)
				.slice(0, 5);

			const counts = active.map((p) => p.runTypes[def.key].countPer30);
			const rate = (pick: (m: (typeof active)[number]['runTypes'][RunTypeKey]) => number) =>
				counts.length ? weightedMean(active.map((p) => (pick(p.runTypes[def.key]) / (p.runTypes[def.key].countPer30 || 1)) * 100), counts) : NaN;

			const distances = active.map((p) => p.runTypes[def.key].avgDistanceM).filter((d): d is number => d !== null);
			const distanceWeights = active
				.filter((p) => p.runTypes[def.key].avgDistanceM !== null)
				.map((p) => p.runTypes[def.key].countPer30);

			return {
				def,
				byPosition,
				topPlayers,
				playerCount: active.length,
				targetRate: rate((m) => m.targetedPer30),
				receiveRate: rate((m) => m.receivedPer30),
				dangerousRate: rate((m) => m.dangerousPer30),
				shotRate: rate((m) => m.shotWithin10sPer30),
				goalRate: rate((m) => m.goalWithin10sPer30),
				aboveHsrRate: rate((m) => m.aboveHsrPer30),
				avgDistance: distances.length ? weightedMean(distances, distanceWeights) : NaN
			};
		});
	});
</script>

<svelte:head>
	<title>Run Types — SkillCorner</title>
</svelte:head>

<PageShell
	eyebrow="Glossary"
	title="Run types"
	subtitle="SkillCorner sorts every off-ball run into one of 10 types, plus the combined total below. Rates are the share of that run type's occurrences that led to each outcome, averaged across qualifying players and weighted by how often they make the run."
>
	<FilterBar dataset={data.dataset} />

	{#if filtered.length === 0}
		<EmptyState />
	{:else}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#each cards as card (card.def.key)}
				<article class="chamfer-sm grid gap-4 border border-border bg-bg-raised p-6">
					<div class="grid gap-1">
						<h2 class="text-base font-medium text-fg">{card.def.label}</h2>
						<p class="text-xs text-fg-faint">{card.def.definition}</p>
					</div>

					{#if card.playerCount === 0}
						<p class="text-xs text-fg-faint">No players in the current filter make this run.</p>
					{:else}
						<div class="grid gap-2">
							<h3 class="text-[10px] tracking-[0.1em] text-fg-faint uppercase">Most common by position (median / 30)</h3>
							<PositionBarList items={card.byPosition} unit="per30" />
						</div>

						<div class="grid gap-2">
							<h3 class="text-[10px] tracking-[0.1em] text-fg-faint uppercase">Top players</h3>
							<ol class="grid gap-1.5 text-sm">
								{#each card.topPlayers as player, i (player.id)}
									<li class="flex items-center justify-between gap-2">
										<a href="/players/{player.id}" class="flex items-center gap-2 text-fg hover:text-accent-ink">
											<span class="font-mono text-fg-faint tabular-nums">{i + 1}.</span>
											{player.player}
											<PositionTag position={player.position} />
										</a>
										<span class="font-mono font-medium text-fg tabular-nums">{formatRate(player.runTypes[card.def.key].countPer30)}</span>
									</li>
								{/each}
							</ol>
						</div>

						<div class="grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-4">
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Targeted</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.targetRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Received</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.receiveRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Dangerous</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.dangerousRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Shot in 10s</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.shotRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Goal in 10s</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.goalRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Above HSR</span>
								<span class="font-mono text-sm font-medium text-fg">{formatPct(card.aboveHsrRate)}</span>
							</div>
							<div class="grid gap-0.5">
								<span class="text-[10px] text-fg-faint uppercase">Avg distance</span>
								<span class="font-mono text-sm font-medium text-fg">{Number.isFinite(card.avgDistance) ? `${card.avgDistance.toFixed(1)} m` : '—'}</span>
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</PageShell>
