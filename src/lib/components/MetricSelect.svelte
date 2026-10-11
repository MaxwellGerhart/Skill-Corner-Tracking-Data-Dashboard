<script lang="ts">
	import type { MetricDef } from '../data/metrics';

	let {
		value = $bindable(),
		options,
		label
	}: {
		value: string;
		options: MetricDef[];
		label: string;
	} = $props();
</script>

<label class="grid gap-1 text-xs text-fg-soft">
	{label}
	<select
		bind:value
		class="border border-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent-ink focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-1"
	>
		{#each options as option (option.key)}
			<option value={option.key}>{option.label}</option>
		{/each}
	</select>
</label>
