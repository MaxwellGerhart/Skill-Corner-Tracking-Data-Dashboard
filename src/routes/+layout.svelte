<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/skillcorner/favicon-source.jpg';
	import NavBar from '#lib/components/NavBar.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import BackgroundDecor from '#lib/components/BackgroundDecor.svelte';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import { setFilterState } from '../lib/stores/filters.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// data.dataset is identical on every route (one root load, cached server-side) so the
	// matches floor never actually changes across navigation.
	// svelte-ignore state_referenced_locally
	setFilterState(data.dataset.meta.minMatchesFloor);
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/jpeg" />
	<title>SkillCorner — Off-ball Runs Dashboard</title>
</svelte:head>

<!-- isolate: the decor's -z-10 then sits above this background but below all content. -->
<div class="isolate flex min-h-screen flex-col bg-bg text-fg md:flex-row">
	<BackgroundDecor />
	<NavBar />
	<div class="flex min-w-0 flex-1 flex-col">
		<main class="flex-1">
			{@render children()}
		</main>
		<Footer />
	</div>
</div>

<CommandPalette dataset={data.dataset} matches={data.matches} />
