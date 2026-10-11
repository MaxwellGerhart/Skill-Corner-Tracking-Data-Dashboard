<script lang="ts">
	import { getFilterState, ALL } from '../stores/filters.svelte';
	import type { Dataset } from '../data/types';

	let { dataset }: { dataset: Dataset } = $props();

	const filters = getFilterState();
</script>

<div class="flex flex-wrap items-end gap-4 border border-border bg-bg-raised p-4">
	<label class="grid gap-1 text-xs text-fg-soft">
		Position
		<select
			bind:value={filters.position}
			class="border border-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-1"
		>
			<option value={ALL}>All positions</option>
			{#each dataset.positions as position (position)}
				<option value={position}>{position}</option>
			{/each}
		</select>
	</label>

	<label class="grid gap-1 text-xs text-fg-soft">
		Team
		<select
			bind:value={filters.team}
			class="max-w-50 border border-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-1"
		>
			<option value={ALL}>All teams</option>
			{#each dataset.teams as team (team)}
				<option value={team}>{team}</option>
			{/each}
		</select>
	</label>

	<label class="grid gap-1 text-xs text-fg-soft">
		Min. matches: <span class="font-mono text-fg">{filters.minMatches}</span>
		<input
			type="range"
			min={dataset.meta.minMatchesFloor}
			max={dataset.meta.maxMatches}
			bind:value={filters.minMatches}
			class="range-accent w-40"
			style="--fill: {((filters.minMatches - dataset.meta.minMatchesFloor) / Math.max(1, dataset.meta.maxMatches - dataset.meta.minMatchesFloor)) * 100}%"
		/>
	</label>

	<button
		type="button"
		onclick={() => filters.reset(dataset.meta.minMatchesFloor)}
		class="cursor-pointer border border-border bg-transparent px-3 py-2 text-xs tracking-[0.08em] text-fg-soft uppercase hover:border-fg-soft hover:text-fg"
	>
		Reset
	</button>
</div>
