<script lang="ts">
	import type { PageData } from './$types';
	import { getFilterState, applyFilters } from '../../lib/stores/filters.svelte';
	import { PageShell, FilterBar, EmptyState, PositionTag, PlayerAvatar } from '#lib';
	import { formatPct, formatRate } from '../../lib/utils/format';

	let { data }: { data: PageData } = $props();
	const filters = getFilterState();

	let search = $state('');

	const filtered = $derived(applyFilters(data.dataset.players, filters));

	const results = $derived.by(() => {
		const q = search.trim().toLowerCase();
		const list = q
			? filtered.filter((p) => p.player.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
			: filtered;
		return [...list].sort((a, b) => a.player.localeCompare(b.player));
	});
</script>

<svelte:head>
	<title>Players — SkillCorner</title>
</svelte:head>

<PageShell
	eyebrow="Directory"
	title="Players"
	subtitle="Find a player and open their profile. Players who appear in more than one position are listed once per position."
>
	<FilterBar dataset={data.dataset} />

	<label class="grid max-w-sm gap-1 text-xs text-fg-soft">
		Search by player or team
		<input
			type="text"
			bind:value={search}
			placeholder="e.g. Goodwin, or Adelaide"
			class="border border-border bg-bg-raised px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:border-accent-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-1"
		/>
	</label>

	{#if results.length === 0}
		<EmptyState message={search ? 'No players match that search.' : 'No players match these filters.'} />
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each results as player (player.id)}
				<a
					href="/players/{player.id}"
					class="block focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
				>
					<div
						class="chamfer-sm grid gap-2 border border-border bg-bg-raised p-4 transition-colors hover:border-accent-ink"
					>
						<div class="flex items-start justify-between gap-2">
							<span class="flex items-center gap-3">
								<PlayerAvatar playerId={player.playerId} name={player.player} hasHeadshot={player.hasHeadshot} size={40} />
								<span class="font-medium text-fg">{player.player}</span>
							</span>
							<PositionTag position={player.position} />
						</div>
						<span class="text-xs text-fg-faint">{player.team}</span>
						<div class="mt-1 flex items-center gap-4 font-mono text-xs">
							<span class="text-fg-soft">Runs/30 <strong class="font-medium text-fg">{formatRate(player.runsPer30)}</strong></span>
							<span class="text-fg-soft">% dangerous <strong class="font-medium text-fg">{formatPct(player.pctDangerous)}</strong></span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</PageShell>
