<script lang="ts" module>
	export type BadgeVariant = 'solid' | 'solid-dark' | 'outline';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'solid',
		children
	}: {
		variant?: BadgeVariant;
		children: Snippet;
	} = $props();

	const variants: Record<BadgeVariant, string> = {
		solid: 'bg-accent text-ink-950 px-2.5 py-1',
		'solid-dark': 'bg-accent-ink text-white px-2.5 py-1',
		outline: 'border border-line text-ink-700 px-[9px] py-[3px]'
	};
</script>

<span class="text-[10px] font-medium tracking-[0.1em] uppercase {variants[variant]}">
	{@render children()}
</span>
