<script lang="ts">
	import type { Snippet } from 'svelte';
	import Eyebrow from './Eyebrow.svelte';

	let {
		eyebrow,
		title,
		subtitle,
		hero = false,
		heroImage,
		heroCredit,
		children
	}: {
		eyebrow: string;
		title: string;
		subtitle?: string;
		hero?: boolean;
		heroImage?: string;
		heroCredit?: string;
		children: Snippet;
	} = $props();
</script>

{#if hero}
	<header class="chamfer-section relative overflow-hidden bg-ink-900 px-4 pt-10 pb-12 text-paper-50 sm:px-8 sm:pt-14 sm:pb-16">
		{#if heroImage}
			<img src={heroImage} alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
			<div
				class="absolute inset-0"
				style="background: linear-gradient(100deg, var(--color-ink-950) 38%, rgba(22,23,22,0.82) 62%, rgba(22,23,22,0.45) 100%)"
			></div>
			{#if heroCredit}
				<span class="absolute right-3 bottom-2 z-10 text-[10px] text-ink-300/80">{heroCredit}</span>
			{/if}
		{/if}
		<div class="relative z-10 mx-auto grid max-w-6xl gap-4">
			<Eyebrow tone="dark">{eyebrow}</Eyebrow>
			<h1 class="m-0 max-w-2xl text-[clamp(28px,4.5vw,44px)] leading-[1.08] font-light text-wrap-pretty">{title}</h1>
			{#if subtitle}
				<p class="max-w-2xl text-sm leading-relaxed text-ink-300">{subtitle}</p>
			{/if}
		</div>
	</header>
	<div class="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-8">
		{@render children()}
	</div>
{:else}
	<div class="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-8">
		<header class="grid gap-2">
			<Eyebrow>{eyebrow}</Eyebrow>
			<h1 class="m-0 text-3xl font-light text-fg">{title}</h1>
			{#if subtitle}
				<p class="max-w-2xl text-sm text-fg-soft">{subtitle}</p>
			{/if}
		</header>
		{@render children()}
	</div>
{/if}
