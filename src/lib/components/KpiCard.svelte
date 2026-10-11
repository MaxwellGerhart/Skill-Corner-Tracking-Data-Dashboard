<script lang="ts">
	let {
		label,
		value,
		caption
	}: {
		label: string;
		value: string;
		caption?: string;
	} = $props();
</script>

<div class="grid gap-1.5 border-r border-b border-border bg-bg-raised p-6">
	<span class="text-[10px] tracking-[0.14em] text-fg-faint uppercase">{label}</span>
	<span class="font-mono text-4xl font-light tabular-nums text-fg">{value}</span>
	{#if caption}
		<span class="text-xs text-fg-faint">{caption}</span>
	{/if}
</div>
