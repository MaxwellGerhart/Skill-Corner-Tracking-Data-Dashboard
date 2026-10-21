<script lang="ts">
	import { getFilterState, ALL } from '../stores/filters.svelte';
	import type { Dataset } from '../data/types';
	import Select from './Select.svelte';

	let { dataset }: { dataset: Dataset } = $props();

	const filters = getFilterState();
</script>

<div class="flex flex-wrap items-end gap-4 border border-border bg-bg-raised p-4">
	<Select
		label="Position"
		bind:value={filters.position}
		options={[{ value: ALL, label: 'All positions' }, ...dataset.positions.map((p) => ({ value: p, label: p }))]}
		class="w-44"
	/>

	<Select
		label="Team"
		bind:value={filters.team}
		options={[{ value: ALL, label: 'All teams' }, ...dataset.teams.map((t) => ({ value: t, label: t }))]}
		class="w-60"
	/>

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
