<script lang="ts">
	import type { PageData } from './$types';
	import { PageShell, SlidingTabs } from '#lib';
	import MatchViewer from '../../../lib/components/match/MatchViewer.svelte';
	import { RUN_LABELS } from '../../../lib/match/models';
	import type { MatchRun, Side } from '../../../lib/match/types';

	let { data }: { data: PageData } = $props();

	const meta = $derived(data.meta);
	const events = $derived(data.events);

	// svelte-ignore state_referenced_locally
	let frame = $state(data.meta.periods[0].startFrame);
	let playing = $state(false);
	let focusRun = $state<MatchRun | null>(null);
	let highlightSlot = $state<number | null>(null);
	let selectedKey = $state<string | null>(null);

	type Tab = 'shots' | 'shotRuns' | 'dangerous';
	let tab = $state<Tab>('shots');

	const shotRuns = $derived(events.runs.filter((r) => r.leadToShot));
	const dangerousRuns = $derived(events.runs.filter((r) => r.dangerous));

	const TABS: { key: Tab; label: string }[] = [
		{ key: 'shots', label: 'Shots' },
		{ key: 'shotRuns', label: 'Runs → shot' },
		{ key: 'dangerous', label: 'Dangerous runs' }
	];

	const tabCounts = $derived<Record<Tab, number>>({
		shots: events.shots.length,
		shotRuns: shotRuns.length,
		dangerous: dangerousRuns.length
	});

	const dateLabel = $derived(
		new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(meta.date))
	);

	const teamName = (side: Side) => (side === 'home' ? meta.home.shortName : meta.away.shortName);

	function jumpToShot(shot: (typeof events.shots)[number]) {
		focusRun = null;
		highlightSlot = shot.slot;
		selectedKey = `shot-${shot.frame}`;
		frame = Math.max(meta.periods[0].startFrame, shot.frame - 8 * meta.fps);
		playing = true;
	}

	function jumpToRun(run: MatchRun) {
		focusRun = run;
		highlightSlot = run.slot;
		selectedKey = run.id;
		frame = Math.max(meta.periods[0].startFrame, run.frameStart - 2 * meta.fps);
		playing = true;
	}

	function clearSelection() {
		focusRun = null;
		highlightSlot = null;
		selectedKey = null;
	}

	const runList = $derived(tab === 'shotRuns' ? shotRuns : dangerousRuns);
</script>

<svelte:head>
	<title>{meta.home.shortName} {meta.home.score}–{meta.away.score} {meta.away.shortName} — SkillCorner</title>
</svelte:head>

<PageShell eyebrow="{meta.round} · {meta.competition}" title="{meta.home.shortName} {meta.home.score}–{meta.away.score} {meta.away.shortName}" subtitle="{dateLabel} · {meta.stadium}">
	<MatchViewer {meta} {events} bind:frame bind:playing {focusRun} {highlightSlot} />

	<section class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<div class="grid content-start gap-4 border border-border bg-bg-raised p-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="grid gap-1">
					<h2 class="text-sm font-medium text-fg">Key moments</h2>
					<p class="text-xs text-fg-faint">Pick a moment to replay it. Runs are drawn on the pitch and the player is ringed.</p>
				</div>
				{#if selectedKey}
					<button type="button" onclick={clearSelection} class="cursor-pointer border border-border bg-transparent px-2.5 py-1 text-xs text-fg-soft hover:border-fg-soft hover:text-fg">
						Clear selection
					</button>
				{/if}
			</div>

			<SlidingTabs
				variant="underline"
				label="Key moment type"
				bind:value={tab}
				options={TABS.map((t) => ({ value: t.key, label: t.label, count: tabCounts[t.key] }))}
				class="flex w-full flex-wrap"
			/>

			<div class="max-h-[28rem] overflow-y-auto">
				<table class="w-full border-collapse text-sm">
					<thead class="sticky top-0 bg-bg-raised">
						<tr class="text-left text-[10px] tracking-[0.1em] text-fg-faint uppercase">
							<th class="w-12 py-2 pr-3 font-normal">Min</th>
							<th class="py-2 pr-3 font-normal">Player</th>
							<th class="py-2 pr-3 font-normal">{tab === 'shots' ? 'Outcome' : 'Run'}</th>
							<th class="py-2 font-normal"><span class="sr-only">Replay</span></th>
						</tr>
					</thead>
					<tbody>
						{#if tab === 'shots'}
							{#each events.shots as shot (shot.frame)}
								{@const key = `shot-${shot.frame}`}
								<tr class="border-t border-border {selectedKey === key ? 'bg-bg-sunken' : ''}">
									<td class="py-2 pr-3 font-mono text-fg-soft tabular-nums">{shot.minute}'</td>
									<td class="py-2 pr-3">
										<span class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 shrink-0 rounded-full {shot.team === 'home' ? 'bg-team-home' : 'bg-team-away'}" aria-hidden="true"></span>
											<span class="text-fg">{shot.player}</span>
											<span class="hidden text-xs text-fg-faint sm:inline">{teamName(shot.team)}</span>
										</span>
									</td>
									<td class="py-2 pr-3 text-xs">
										{#if shot.goal}
											<span class="bg-accent px-1.5 py-0.5 font-medium tracking-[0.08em] text-ink-950 uppercase">Goal</span>
										{:else}
											<span class="text-fg-faint">Shot</span>
										{/if}
									</td>
									<td class="py-2 text-right">
										<button type="button" onclick={() => jumpToShot(shot)} class="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent-ink hover:text-fg">Replay ▸</button>
									</td>
								</tr>
							{/each}
						{:else}
							{#each runList as run (run.id)}
								<tr class="border-t border-border {selectedKey === run.id ? 'bg-bg-sunken' : ''}">
									<td class="py-2 pr-3 font-mono text-fg-soft tabular-nums">{run.minute}'</td>
									<td class="py-2 pr-3">
										<span class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 shrink-0 rounded-full {run.team === 'home' ? 'bg-team-home' : 'bg-team-away'}" aria-hidden="true"></span>
											<span class="text-fg">{run.player}</span>
										</span>
									</td>
									<td class="py-2 pr-3 text-xs text-fg-soft">
										{RUN_LABELS[run.subtype] ?? run.subtype}
										{#if run.received}<span class="text-fg-faint"> · received</span>{:else if run.targeted}<span class="text-fg-faint"> · targeted</span>{/if}
										{#if run.leadToGoal}<span class="ml-1 bg-accent px-1 py-0.5 text-[10px] font-medium text-ink-950 uppercase">Goal</span>{/if}
									</td>
									<td class="py-2 text-right">
										<button type="button" onclick={() => jumpToRun(run)} class="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent-ink hover:text-fg">Replay ▸</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>

		<div class="grid content-start gap-4 border border-border bg-bg-raised p-6 text-sm text-fg-soft">
			<h2 class="text-sm font-medium text-fg">How to read this view</h2>
			<dl class="m-0 grid gap-3 text-xs leading-relaxed">
				<div>
					<dt class="font-medium text-fg">Off camera</dt>
					<dd class="m-0">SkillCorner tracks from the TV broadcast, so players outside the shot are <em>extrapolated</em>. They appear as dashed rings; the dashed box is the camera's footprint.</dd>
				</div>
				<div>
					<dt class="font-medium text-fg">Orientation &amp; vision cones</dt>
					<dd class="m-0">Estimated, not measured: a moving player faces where they're running, a standing player faces the ball.</dd>
				</div>
				<div>
					<dt class="font-medium text-fg">Pitch control</dt>
					<dd class="m-0">A simplified time-to-reach model: each spot is shaded by which team's nearest player could get there first, allowing a 0.7 s reaction and 5 m/s top speed. It ignores ball flight time.</dd>
				</div>
				<div>
					<dt class="font-medium text-fg">Voronoi</dt>
					<dd class="m-0">Each cell is the area closer to that player than to anyone else. A simple picture of space, ignoring speed and direction.</dd>
				</div>
				<div>
					<dt class="font-medium text-fg">Off-ball runs</dt>
					<dd class="m-0">Dashed arrows are SkillCorner-detected runs from the same data as the season pages, drawn from where the run starts to where it ends.</dd>
				</div>
			</dl>
		</div>
	</section>
</PageShell>
