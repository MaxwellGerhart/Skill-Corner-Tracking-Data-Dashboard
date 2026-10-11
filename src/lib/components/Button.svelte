<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
	export type ButtonSurface = 'light' | 'dark';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'primary',
		surface = 'light',
		href,
		onclick,
		children
	}: {
		variant?: ButtonVariant;
		surface?: ButtonSurface;
		href?: string;
		onclick?: () => void;
		children: Snippet;
	} = $props();

	const base =
		'font-sans text-[11px] font-medium tracking-[0.12em] uppercase cursor-pointer transition-colors border-0';

	const variants: Record<ButtonVariant, Record<ButtonSurface, string>> = {
		primary: {
			light: `${base} btn-accent px-5 py-3`,
			dark: `${base} btn-accent px-5 py-3`
		},
		secondary: {
			light: `${base} bg-ink-900 text-paper-50 px-5 py-3 hover:bg-ink-700`,
			dark: `${base} bg-paper-50 text-ink-950 px-5 py-3 hover:bg-paper-100`
		},
		ghost: {
			light: `${base} bg-transparent text-ink-900 border border-ink-300 px-[19px] py-[11px] hover:border-ink-900`,
			dark: `${base} bg-transparent text-paper-50 border border-ink-500 px-[19px] py-[11px] hover:border-paper-50`
		},
		icon: {
			light: `${base} w-9 h-9 grid place-items-center btn-accent text-base`,
			dark: `${base} w-9 h-9 grid place-items-center btn-accent text-base`
		}
	};

	const classes = $derived(variants[variant][surface]);
</script>

{#if href}
	<a {href} class={classes} style="display:inline-flex;align-items:center;justify-content:center">
		{@render children()}
	</a>
{:else}
	<button type="button" {onclick} class={classes}>
		{@render children()}
	</button>
{/if}
