<script lang="ts">
	import type { PageData } from './$types';
	import { PageShell, PositionTag, RunTypeMixBar, FunnelSteps, PercentileBar, TeamLogo, PlayerAvatar, AnimatedNumber } from '#lib';
	import { SPECIFIC_RUN_TYPE_DEFINITIONS } from '../../../lib/data/runTypes';
	import { METRICS, type MetricDef } from '../../../lib/data/metrics';
	import { median, percentileRank } from '../../../lib/utils/stats';
	import { percentileColor, PERCENTILE_BANDS } from '../../../lib/utils/percentileColor';
	import { formatInt } from '../../../lib/utils/format';
	import type { PlayerRecord } from '../../../lib/data/types';

	let { data }: { data: PageData } = $props();

	const player = $derived(data.player);

	const siblings = $derived(
		data.dataset.players
			.filter((p) => p.playerId === player.playerId)
			.sort((a, b) => a.position.localeCompare(b.position))
	);

	const positionPeers = $derived(data.dataset.players.filter((p) => p.position === player.position));

	// Sorted by percentile so bar lengths step down the card: strongest run types first.
	const runTypeMix = $derived(
		SPECIFIC_RUN_TYPE_DEFINITIONS.map((def) => ({
			label: def.label,
			value: player.runTypes[def.key].countPer30,
			median: median(positionPeers.map((p) => p.runTypes[def.key].countPer30)),
			percentile: peerPercentile((p) => p.runTypes[def.key].countPer30)
		})).sort((a, b) => b.percentile - a.percentile)
	);

	/** Where this player sits among their position group for any per-player value. */
	function peerPercentile(access: (p: PlayerRecord) => number): number {
		return percentileRank(access(player), positionPeers.map(access));
	}

	const runsFunnel = $derived.by(() => {
		const all = player.runTypes.offballrun;
		return [
			{ label: 'All runs', value: all.countPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.countPer30) },
			{ label: 'Targeted', value: all.targetedPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.targetedPer30) },
			{ label: 'Received', value: all.receivedPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.receivedPer30) }
		];
	});

	const dangerFunnel = $derived.by(() => {
		const all = player.runTypes.offballrun;
		return [
			{ label: 'Dangerous runs', value: all.dangerousPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.dangerousPer30) },
			{ label: 'Shot within 10s', value: all.shotWithin10sPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.shotWithin10sPer30) },
			{ label: 'Goal within 10s', value: all.goalWithin10sPer30, percentile: peerPercentile((p) => p.runTypes.offballrun.goalWithin10sPer30) }
		];
	});

	const percentileMetrics = $derived(METRICS.filter((m) => m.unit !== 'matches' && m.unit !== 'count'));

	function metricPercentile(metric: MetricDef): number {
		return peerPercentile((p) => metric.access(p));
	}
</script>

<svelte:head>
	<title>{player.player} — SkillCorner</title>
</svelte:head>

<PageShell eyebrow="Profile" title={player.player}>
	<section class="chamfer-sm grid gap-4 border border-border bg-bg-raised p-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<PlayerAvatar playerId={player.playerId} name={player.player} hasHeadshot={player.hasHeadshot} size={72} />
				<div class="grid gap-1">
					<span class="flex items-center gap-2 text-sm text-fg-soft">
						<TeamLogo teamId={player.teamId} name={player.team} size={28} />
						{player.team}
					</span>
					<div class="flex items-center gap-2 text-sm">
						<PositionTag position={player.position} />
					</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-6 text-sm">
				<div class="grid">
					<span class="text-[10px] tracking-[0.1em] text-fg-faint uppercase">Matches</span>
					<span class="font-mono font-medium text-fg tabular-nums"><AnimatedNumber value={player.matches} format={formatInt} duration={900} /></span>
				</div>
				<div class="grid">
					<span class="text-[10px] tracking-[0.1em] text-fg-faint uppercase">Minutes in possession / match</span>
					<span class="font-mono font-medium text-fg tabular-nums"><AnimatedNumber value={player.minutesTip} format={(n) => n.toFixed(1)} duration={900} /></span>
				</div>
			</div>
		</div>

		{#if siblings.length > 1}
			<div class="flex flex-wrap items-center gap-2 border-t border-border pt-4">
				<span class="text-xs text-fg-faint">Positions played:</span>
				{#each siblings as sibling (sibling.id)}
					<a
						href="/players/{sibling.id}"
						class="border px-2.5 py-1 text-xs {sibling.id === player.id
							? 'border-accent-ink text-accent-ink'
							: 'border-border text-fg-soft hover:border-fg-soft hover:text-fg'}"
					>
						{sibling.position}
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-faint">
		<span>Bar colour: percentile vs. other {player.position}s</span>
		<span class="flex flex-wrap items-center gap-x-3 gap-y-1">
			{#each PERCENTILE_BANDS as low (low)}
				<span class="flex items-center gap-1.5">
					<span aria-hidden="true" class="h-2.5 w-2.5" style="background: {percentileColor(low)}"></span>
					<span class="font-mono tabular-nums">{low}–{low + 20}</span>
				</span>
			{/each}
		</span>
	</div>

	<section class="grid gap-6 lg:grid-cols-2">
		<div class="grid gap-4 border border-border bg-bg-raised p-6">
			<div class="grid gap-1">
				<h2 class="text-sm font-medium text-fg">Run-type mix</h2>
				<p class="text-xs text-fg-faint">
					Bar length is the percentile vs. other {player.position}s for runs per 30 of each type; the tick is the
					median (50th). The number is the player's runs per 30.
				</p>
			</div>
			<div class="grid gap-2.5">
				{#each runTypeMix as row (row.label)}
					<RunTypeMixBar
						label={row.label}
						value={row.value}
						median={row.median}
						percentile={row.percentile}
						unit="per30"
					/>
				{/each}
			</div>
		</div>

		<div class="grid gap-6">
			<div class="grid gap-3 border border-border bg-bg-raised p-6">
				<div class="grid gap-1">
					<h2 class="text-sm font-medium text-fg">From run to possession</h2>
					<p class="text-xs text-fg-faint">Bar length is the percentile per 30; the tick is the median.</p>
				</div>
				<FunnelSteps steps={runsFunnel} unit="per30" />
			</div>
			<div class="grid gap-3 border border-border bg-bg-raised p-6">
				<div class="grid gap-1">
					<h2 class="text-sm font-medium text-fg">From danger to goal</h2>
					<p class="text-xs text-fg-faint">Bar length is the percentile per 30; the tick is the median.</p>
				</div>
				<FunnelSteps steps={dangerFunnel} unit="per30" />
			</div>
		</div>
	</section>

	<section class="grid gap-4 border border-border bg-bg-raised p-6">
		<div class="grid gap-1">
			<h2 class="text-sm font-medium text-fg">Percentile vs. {player.position}</h2>
			<p class="text-xs text-fg-faint">Among all {positionPeers.length} {player.position} player-positions in the dataset.</p>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each percentileMetrics as metric (metric.key)}
				<PercentileBar label={metric.label} value={metric.access(player)} unit={metric.unit} percentile={metricPercentile(metric)} />
			{/each}
		</div>
	</section>
</PageShell>
