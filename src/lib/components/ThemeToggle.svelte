<script lang="ts">
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'fieldline-theme';

	let theme = $state<'light' | 'dark'>('dark');

	function apply(next: 'light' | 'dark') {
		theme = next;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem(STORAGE_KEY, next);
	}

	function toggle() {
		apply(theme === 'dark' ? 'light' : 'dark');
	}

	onMount(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		const mq = window.matchMedia('(prefers-color-scheme: dark)');

		theme = stored === 'light' || stored === 'dark' ? stored : mq.matches ? 'dark' : 'light';

		// Follow the OS live, as long as the viewer hasn't made an explicit choice here.
		function handleSystemChange(e: MediaQueryListEvent) {
			if (!localStorage.getItem(STORAGE_KEY)) theme = e.matches ? 'dark' : 'light';
		}
		mq.addEventListener('change', handleSystemChange);
		return () => mq.removeEventListener('change', handleSystemChange);
	});
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
	class="grid h-8 w-8 cursor-pointer place-items-center border-0 bg-transparent text-ink-300 hover:text-paper-50"
>
	{#if theme === 'dark'}
		<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
			<circle cx="8" cy="8" r="3" />
			<line x1="8" y1="0.5" x2="8" y2="2.3" />
			<line x1="8" y1="13.7" x2="8" y2="15.5" />
			<line x1="0.5" y1="8" x2="2.3" y2="8" />
			<line x1="13.7" y1="8" x2="15.5" y2="8" />
			<line x1="2.6" y1="2.6" x2="3.9" y2="3.9" />
			<line x1="12.1" y1="12.1" x2="13.4" y2="13.4" />
			<line x1="2.6" y1="13.4" x2="3.9" y2="12.1" />
			<line x1="12.1" y1="3.9" x2="13.4" y2="2.6" />
		</svg>
	{:else}
		<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
			<path d="M8.5 1.5a6.5 6.5 0 1 0 6 9 5 5 0 0 1-6-9Z" />
		</svg>
	{/if}
</button>
