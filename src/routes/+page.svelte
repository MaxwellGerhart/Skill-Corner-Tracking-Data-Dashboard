<script lang="ts">
	import type { PageData } from './$types';
	import { getFilterState, applyFilters } from '../lib/stores/filters.svelte';
	import { PageShell, KpiCard, FilterBar, PositionBarList, EmptyState, PositionTag } from '#lib';
	import { formatInt, formatPct, formatRate } from '../lib/utils/format';
	import { median, weightedMean, groupBy } from '../lib/utils/stats';
	import { POSITION_ORDER } from '../lib/utils/positions';

	let { data }: { data: PageData } = $props();
	const filters = getFilterState();

	const filtered = $derived(applyFilters(data.dataset.players, filters));

	const kpis = $derived.by(() => {
		const players = filtered;
		const distinctPlayers = new Set(players.map((p) => p.playerId)).size;
		const distinctTeams = new Set(players.map((p) => p.team)).size;
		const totalRuns = players.reduce((s, p) => s + p.totalRuns, 0);
		const leagueWidePctDangerous = weightedMean(
			players.map((p) => p.pctDangerous),
			players.map((p) => p.totalRuns)
		);
		return { distinctPlayers, distinctTeams, totalRuns, leagueWidePctDangerous };
	});

	const byPosition = $derived.by(() => {
		const groups = groupBy(filtered, (p) => p.position);
		return POSITION_ORDER.filter((pos) => groups.has(pos)).map((pos) => {
			const players = groups.get(pos) ?? [];
			return {
				position: pos,
				medianRunsPer30: median(players.map((p) => p.runsPer30)),
				medianPctDangerous: median(players.map((p) => p.pctDangerous))
			};
		});
	});

	const top5 = $derived([...filtered].sort((a, b) => b.dangerousRunsPer30 - a.dangerousRunsPer30).slice(0, 5));
</script>

<svelte:head>
	<title>Overview — SkillCorner</title>
</svelte:head>

<PageShell
	hero
	eyebrow="SkillCorner · A-League 2024/25"
	title="Off-ball running, measured."
	subtitle="An off-ball run is a purposeful sprint a player makes without the ball — into space, towards the ball, or around a teammate. SkillCorner detects these from broadcast tracking data and rates each one as dangerous if it meaningfully raised the team's chance of scoring. Every rate below is per 30 minutes of team possession, not per match, so players from possession-heavy and counter-attacking teams can be compared fairly."
>
	<FilterBar dataset={data.dataset} />

	{#if filtered.length === 0}
		<EmptyState />
	{:else}
		<section class="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
			<KpiCard
				label="Players"
				value={kpis.distinctPlayers}
				format={formatInt}
				caption="Unique players (some play more than one position)"
			/>
			<KpiCard label="Teams" value={kpis.distinctTeams} format={formatInt} />
			<KpiCard label="Total runs" value={kpis.totalRuns} format={formatInt} caption="Across the filtered sample" />
			<KpiCard
				label="League-wide % dangerous"
				value={kpis.leagueWidePctDangerous}
				format={formatPct}
				caption="Share of all runs rated dangerous"
			/>
		</section>

		<section class="grid gap-6 lg:grid-cols-2">
			<div class="grid gap-3 border border-border bg-bg-raised p-6">
				<h2 class="text-sm font-medium text-fg">Median runs per 30 by position</h2>
				<PositionBarList
					items={byPosition.map((p) => ({ position: p.position, value: p.medianRunsPer30 }))}
					unit="per30"
				/>
			</div>
			<div class="grid gap-3 border border-border bg-bg-raised p-6">
				<h2 class="text-sm font-medium text-fg">Median % dangerous by position</h2>
				<PositionBarList
					items={byPosition.map((p) => ({ position: p.position, value: p.medianPctDangerous }))}
					unit="pct"
				/>
			</div>
		</section>

		<section class="grid gap-3">
			<h2 class="text-sm font-medium text-fg">Top 5 by dangerous runs per 30</h2>
			<div class="overflow-x-auto border border-border bg-bg-raised">
				<table class="w-full min-w-120 border-collapse text-sm">
					<thead>
						<tr class="border-b border-border bg-bg-sunken text-left text-xs text-fg-faint uppercase">
							<th class="px-4 py-2.5 font-medium">Player</th>
							<th class="px-4 py-2.5 font-medium">Team</th>
							<th class="px-4 py-2.5 font-medium">Position</th>
							<th class="px-4 py-2.5 text-right font-medium">Dangerous/30</th>
							<th class="px-4 py-2.5 text-right font-medium">% dangerous</th>
						</tr>
					</thead>
					<tbody>
						{#each top5 as player (player.id)}
							<tr class="border-b border-border last:border-b-0 hover:bg-bg-sunken">
								<td class="px-4 py-2.5">
									<a href="/players/{player.id}" class="font-medium text-fg hover:text-accent-ink">{player.player}</a>
								</td>
								<td class="px-4 py-2.5 text-fg-soft">{player.team}</td>
								<td class="px-4 py-2.5"><PositionTag position={player.position} /></td>
								<td class="px-4 py-2.5 text-right font-mono font-medium text-fg tabular-nums">{formatRate(player.dangerousRunsPer30)}</td>
								<td class="px-4 py-2.5 text-right font-mono text-fg-soft tabular-nums">{formatPct(player.pctDangerous)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</PageShell>
