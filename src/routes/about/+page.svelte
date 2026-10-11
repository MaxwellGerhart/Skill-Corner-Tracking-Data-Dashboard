<script lang="ts">
	import type { PageData } from './$types';
	import { PageShell } from '#lib';
	import { RUN_TYPE_DEFINITIONS } from '../../lib/data/runTypes';
	import { METRICS } from '../../lib/data/metrics';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>About — SkillCorner</title>
</svelte:head>

<PageShell eyebrow="Reference" title="About this dashboard">
	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">Data source</h2>
		<p class="max-w-3xl text-sm text-fg-soft">
			SkillCorner turns broadcast video into player-tracking data, recording every visible player's position ten
			times a second. From that it automatically detects <strong class="text-fg">off-ball runs</strong>: purposeful
			movements a player makes without the ball. SkillCorner and PySport publish a free season summary for the
			{data.dataset.meta.season} {data.dataset.meta.competition} on GitHub at
			<a href="https://github.com/SkillCorner/opendata" class="text-accent-ink hover:text-fg">github.com/SkillCorner/opendata</a>,
			covering every player who appeared that season.
		</p>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">Why "per 30 minutes of possession"</h2>
		<p class="max-w-3xl text-sm text-fg-soft">
			A player can only make an off-ball run for their team while that team has the ball. A striker whose team
			dominates possession gets far more chances to run than one whose team mostly defends. Dividing every count by
			the minutes the player's team actually had the ball ("TIP", team-in-possession) puts every player on the same
			footing, regardless of their team's style. Thirty minutes is roughly how long a team holds the ball in a
			typical match, so the numbers read about like "per game".
		</p>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">Cleaning rules</h2>
		<ul class="grid max-w-3xl list-disc gap-2 pl-5 text-sm text-fg-soft">
			<li>Dropped rows with no recorded minutes — a couple of players SkillCorner couldn't process for their only match.</li>
			<li>Dropped goalkeepers — they don't make attacking off-ball runs.</li>
			<li>
				Kept only player-position pairs with at least {data.dataset.meta.minMatchesFloor} matches, so one freak game
				doesn't make a player look brilliant or terrible. You can raise this floor further with the minimum-matches
				filter on most pages.
			</li>
			<li>
				Treated each player + position as one row. A player who featured as both a winger and a striker gets two
				rows, because the runs expected of each role differ — their profile pages link between them.
			</li>
		</ul>
		<p class="max-w-3xl text-sm text-fg-soft">
			This leaves {data.dataset.meta.playerCount} players across {data.dataset.meta.teamCount} teams, as
			{data.dataset.players.length} player-position rows.
		</p>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">Metric definitions</h2>
		<p class="text-xs text-fg-faint">The columns shown on the Overview, Leaderboard, Explorer and Player Profile pages.</p>
		<dl class="grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
			{#each METRICS as metric (metric.key)}
				<div class="grid gap-0.5">
					<dt class="font-medium text-fg">{metric.label}</dt>
					<dd class="text-fg-soft">{metric.description}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised px-6">
		<h2 class="pt-6 text-sm font-medium text-fg">Run types</h2>
		<div>
			{#each RUN_TYPE_DEFINITIONS as def (def.key)}
				<div class="flex gap-3 border-b border-bg-sunken py-3.5 text-sm last:border-b-0">
					<span aria-hidden="true" class="text-accent-ink">→</span>
					<span><strong class="font-medium text-fg">{def.label}.</strong> <span class="text-fg-faint">{def.definition}</span></span>
				</div>
			{/each}
		</div>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">Outcome definitions</h2>
		<dl class="grid max-w-3xl gap-3 text-sm">
			<div class="grid gap-0.5">
				<dt class="font-medium text-fg">Targeted</dt>
				<dd class="text-fg-soft">The teammate on the ball passed to the runner, whether or not it arrived.</dd>
			</div>
			<div class="grid gap-0.5">
				<dt class="font-medium text-fg">Received</dt>
				<dd class="text-fg-soft">The runner actually got the ball.</dd>
			</div>
			<div class="grid gap-0.5">
				<dt class="font-medium text-fg">Dangerous</dt>
				<dd class="text-fg-soft">
					SkillCorner judged the run valuable: had the runner received the ball there, the team's chance of scoring
					would have risen noticeably — this counts even if the ball never came.
				</dd>
			</div>
			<div class="grid gap-0.5">
				<dt class="font-medium text-fg">Shot / goal within 10s</dt>
				<dd class="text-fg-soft">The team had a shot, or scored, within 10 seconds of the run.</dd>
			</div>
			<div class="grid gap-0.5">
				<dt class="font-medium text-fg">Above HSR</dt>
				<dd class="text-fg-soft">The run was made above the high-speed-running threshold.</dd>
			</div>
		</dl>
	</section>

	<section class="grid gap-3 border border-border bg-bg-raised p-6">
		<h2 class="text-sm font-medium text-fg">A caveat</h2>
		<p class="max-w-3xl text-sm text-fg-soft">
			A dangerous run counts even if the ball never arrives — good movement can create value by dragging defenders
			around on its own. That means these numbers describe the <em>quality of a player's movement</em>, not always
			the end result. For the end result, compare the "% passed to" and "% received" figures alongside it.
		</p>
	</section>
</PageShell>
