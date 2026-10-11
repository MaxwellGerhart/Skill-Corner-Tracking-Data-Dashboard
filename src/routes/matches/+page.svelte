<script lang="ts">
	import type { PageData } from './$types';
	import { PageShell, TeamLogo } from '#lib';

	let { data }: { data: PageData } = $props();

	const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head>
	<title>Matches — SkillCorner</title>
</svelte:head>

<PageShell
	eyebrow="Tracking data"
	title="Matches"
	subtitle="Full-match broadcast tracking: every player and the ball, ten times a second. Open a match to replay it with trails, Voronoi space, pitch control, formation lines and SkillCorner's off-ball runs drawn on top."
>
	{#if data.matches.length === 0}
		<div class="grid place-items-center gap-2 border border-dashed border-border bg-bg-raised px-6 py-16 text-center">
			<span class="text-sm text-fg-soft">No matches have been prepared yet.</span>
			<span class="font-mono text-xs text-fg-faint">.venv\Scripts\python scripts\load_tidb.py 1925299</span>
		</div>
	{:else}
		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.matches as match (match.id)}
				<a href="/matches/{match.id}" class="chamfer-sm group grid gap-4 border border-border bg-bg-raised p-6 hover:border-fg-soft">
					<div class="flex items-center justify-between text-[10px] tracking-[0.14em] text-fg-faint uppercase">
						<span>{match.round}</span>
						<span>{dateFormat.format(new Date(match.date))}</span>
					</div>
					<div class="grid gap-2">
						{#each [match.home, match.away] as team, i (team.id)}
							<div class="flex items-center justify-between gap-3">
								<span class="flex items-center gap-2 text-sm text-fg">
									<TeamLogo teamId={team.id} name={team.name} size={28} />
									{team.name}
									<span class="sr-only">({i === 0 ? 'home' : 'away'})</span>
								</span>
								<span class="font-mono text-xl font-light text-fg tabular-nums">{team.score}</span>
							</div>
						{/each}
					</div>
					<div class="flex items-center justify-between border-t border-border pt-3 text-xs text-fg-faint">
						<span>{match.stadium}</span>
						<span class="text-accent-ink group-hover:text-fg">Replay →</span>
					</div>
				</a>
			{/each}
		</section>
	{/if}
</PageShell>
