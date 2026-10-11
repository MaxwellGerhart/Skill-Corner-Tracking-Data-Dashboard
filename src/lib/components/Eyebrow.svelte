<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'light',
		children
	}: {
		tone?: 'light' | 'dark';
		children: Snippet;
	} = $props();
</script>

<div
	class="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase {tone === 'dark'
		? 'text-ink-300'
		: 'text-ink-500'}"
>
	<!-- Square marker, as on skillcorner.com -->
	<span class="h-[7px] w-[7px] shrink-0 bg-accent-ink" aria-hidden="true"></span>
	{@render children()}
</div>
