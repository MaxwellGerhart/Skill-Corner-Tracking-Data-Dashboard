<script lang="ts">
	import type { MetricDef } from '../data/metrics';
	import Select from './Select.svelte';

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

<Select bind:value {label} options={options.map((o) => ({ value: o.key, label: o.label }))} class="w-60" />
