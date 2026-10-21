<script lang="ts">
	import AnimatedNumber from './AnimatedNumber.svelte';

	let {
		label,
		value,
		format,
		caption
	}: {
		label: string;
		/** A number animates (counting up, then gliding on change); a string renders as-is. */
		value: number | string;
		/** Formats the animated number for display. */
		format?: (n: number) => string;
		caption?: string;
	} = $props();
</script>

<div class="grid gap-1.5 border-r border-b border-border bg-bg-raised p-6">
	<span class="text-[10px] tracking-[0.14em] text-fg-faint uppercase">{label}</span>
	<span class="font-mono text-4xl font-light tabular-nums text-fg">
		{#if typeof value === 'number'}
			<AnimatedNumber {value} {format} />
		{:else}
			{value}
		{/if}
	</span>
	{#if caption}
		<span class="text-xs text-fg-faint">{caption}</span>
	{/if}
</div>
