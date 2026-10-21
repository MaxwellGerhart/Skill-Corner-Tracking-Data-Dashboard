<script lang="ts">
	import { page } from '$app/state';
	import { NAV_ITEMS, isActive } from '../nav';
	import Eyebrow from './Eyebrow.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import skillCornerLogo from '../assets/skillcorner/logo-light.svg';
	import { palette } from '../stores/palette.svelte';

	// Shown on the search trigger; Apple platforms use ⌘, everything else Ctrl.
	let shortcut = $state('Ctrl K');
	$effect(() => {
		if (/Mac|iPhone|iPad/.test(navigator.platform)) shortcut = '⌘K';
	});

	let drawerOpen = $state(false);

	function close() {
		drawerOpen = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && drawerOpen) close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile top bar -->
<div class="flex items-center justify-between gap-3 bg-ink-950 px-4 py-3 text-paper-50 md:hidden">
	<a href="/" class="flex items-center">
		<img src={skillCornerLogo} alt="SkillCorner" class="h-4.5 w-auto" />
	</a>
	<div class="flex items-center gap-1">
		<button
			type="button"
			onclick={() => (palette.open = true)}
			aria-label="Search"
			class="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent text-paper-50"
		>
			<svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
			</svg>
		</button>
		<ThemeToggle />
		<button
			type="button"
			onclick={() => (drawerOpen = !drawerOpen)}
			aria-label="Toggle navigation"
			aria-expanded={drawerOpen}
			class="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent text-paper-50"
		>
			{#if drawerOpen}
				<span class="text-xl leading-none">✕</span>
			{:else}
				<span class="grid gap-1">
					<span class="block h-0.5 w-5 bg-paper-50"></span>
					<span class="block h-0.5 w-5 bg-paper-50"></span>
					<span class="block h-0.5 w-5 bg-paper-50"></span>
				</span>
			{/if}
		</button>
	</div>
</div>

<!-- Mobile drawer -->
{#if drawerOpen}
	<div class="fixed inset-0 z-40 md:hidden">
		<button
			type="button"
			aria-label="Close navigation"
			onclick={close}
			class="absolute inset-0 cursor-default border-0 bg-ink-950/60 p-0"
		></button>
		<nav class="relative z-10 grid w-64 gap-1 bg-ink-950 p-4 text-paper-50" style="height: 100%">
			{#each NAV_ITEMS as item (item.href)}
				<a
					href={item.href}
					onclick={close}
					class="px-3 py-2.5 text-sm {isActive(page.url.pathname, item.href)
						? 'bg-ink-800 text-accent'
						: 'text-ink-300 hover:text-paper-50'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
{/if}

<!-- Desktop sidebar -->
<aside class="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-ink-950 p-5 text-paper-50 md:flex">
	<a href="/" class="mb-6 flex items-center px-3">
		<img src={skillCornerLogo} alt="SkillCorner" class="h-12 w-auto" />
	</a>
	<button
		type="button"
		onclick={() => (palette.open = true)}
		class="mb-4 flex cursor-pointer items-center gap-2.5 border border-ink-800 bg-ink-900 px-3 py-2 text-left text-sm text-ink-400 transition-colors hover:border-ink-700 hover:text-paper-50"
	>
		<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
		</svg>
		<span class="flex-1">Search</span>
		<kbd class="border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">{shortcut}</kbd>
	</button>
	{#each NAV_ITEMS as item (item.href)}
		<a
			href={item.href}
			class="px-3 py-2.5 text-sm transition-colors {isActive(page.url.pathname, item.href)
				? 'bg-ink-800 text-accent'
				: 'text-ink-300 hover:bg-ink-900 hover:text-paper-50'}"
		>
			{item.label}
		</a>
	{/each}
	<div class="mt-auto flex items-center justify-between gap-2 border-t border-ink-800 pt-4">
		<Eyebrow tone="dark">Theme</Eyebrow>
		<ThemeToggle />
	</div>
</aside>
