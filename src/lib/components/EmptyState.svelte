<script lang="ts">
	let { message = 'No players match these filters.' }: { message?: string } = $props();
</script>

<div class="grid place-items-center gap-2 border border-dashed border-border bg-bg-raised px-6 py-16 text-center">
	<span class="text-sm text-fg-soft">{message}</span>
	<span class="text-xs text-fg-faint">Try widening the position, team, or minimum-matches filter.</span>
</div>
