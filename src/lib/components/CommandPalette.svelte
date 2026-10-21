<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { NAV_ITEMS } from '../nav';
	import { palette } from '../stores/palette.svelte';
	import { getFilterState, ALL } from '../stores/filters.svelte';
	import { searchCommands } from '../utils/commandSearch';
	import { SPRING_CURSOR, pop, reduceMotion } from '../utils/motion';
	import { POSITION_SHORT } from '../utils/positions';
	import type { Dataset } from '../data/types';
	import type { MatchSummary } from '../match/types';
	import PlayerAvatar from './PlayerAvatar.svelte';
	import TeamLogo from './TeamLogo.svelte';

	/*
	 * ⌘K / Ctrl+K jump-to-anything: pages, players, teams and matches. Adapted from beUI's
	 * command-palette (github.com/starc007/ui-components, MIT): ranked multi-word search,
	 * grouped results, arrow-key cursor with a highlight that glides between rows, and a
	 * blurred backdrop with a spring-in panel.
	 */
	let { dataset, matches }: { dataset: Dataset; matches: MatchSummary[] } = $props();

	const filters = getFilterState();

	type Visual =
		| { kind: 'player'; playerId: string; name: string; hasHeadshot: boolean }
		| { kind: 'team'; teamId: string; name: string }
		| { kind: 'match'; home: { id: string; name: string }; away: { id: string; name: string } };
	type Command = {
		id: string;
		label: string;
		group: string;
		keywords?: string[];
		hint?: string;
		visual?: Visual;
		run: () => void;
	};

	const teamIds = $derived(new Map(dataset.players.map((p) => [p.team, p.teamId])));

	const commands = $derived.by((): Command[] => [
		...NAV_ITEMS.map((item) => ({
			id: `page-${item.href}`,
			label: item.label,
			group: 'Pages',
			run: () => goto(item.href)
		})),
		...dataset.players.map((p) => ({
			id: `player-${p.id}`,
			label: p.player,
			group: 'Players',
			keywords: [p.team, p.position, POSITION_SHORT[p.position]],
			hint: POSITION_SHORT[p.position],
			visual: { kind: 'player' as const, playerId: p.playerId, name: p.player, hasHeadshot: p.hasHeadshot },
			run: () => goto(`/players/${p.id}`)
		})),
		...dataset.teams.map((team) => ({
			id: `team-${team}`,
			label: team,
			group: 'Teams',
			hint: 'Leaderboard',
			visual: { kind: 'team' as const, teamId: teamIds.get(team) ?? '', name: team },
			run: () => {
				filters.team = team;
				filters.position = ALL;
				goto('/leaderboard');
			}
		})),
		...matches.map((m) => ({
			id: `match-${m.id}`,
			label: `${m.home.shortName} ${m.home.score}–${m.away.score} ${m.away.shortName}`,
			group: 'Matches',
			keywords: [m.round, m.date, m.home.name, m.away.name, m.home.acronym, m.away.acronym],
			hint: m.round,
			visual: {
				kind: 'match' as const,
				home: { id: String(m.home.id), name: m.home.name },
				away: { id: String(m.away.id), name: m.away.name }
			},
			run: () => goto(`/matches/${m.id}`)
		}))
	]);

	let query = $state('');
	// With no query, each group previews a few rows; searching shows more per group.
	const PREVIEW = 4;
	const LIMIT = 8;

	const groups = $derived.by(() => {
		const results = searchCommands(commands, query);
		const map = new Map<string, Command[]>();
		for (const c of results) {
			const list = map.get(c.group) ?? [];
			const cap = c.group === 'Pages' ? Infinity : query.trim() ? LIMIT : PREVIEW;
			if (list.length < cap) list.push(c);
			map.set(c.group, list);
		}
		return [...map.entries()];
	});
	const rows = $derived(groups.flatMap(([, list]) => list));

	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let listEl = $state<HTMLDivElement>();
	let returnFocus: HTMLElement | null = null;

	// The highlight's box within the list; glides between rows.
	const highlight = new Spring({ top: 0, height: 0 }, SPRING_CURSOR);
	let snapNext = true;

	$effect(() => {
		void query;
		active = 0;
		snapNext = true;
	});

	$effect(() => {
		if (!palette.open || !listEl) return;
		void rows;
		const row = listEl.querySelector<HTMLElement>(`[data-index="${active}"]`);
		if (!row) return;
		highlight.set({ top: row.offsetTop, height: row.offsetHeight }, { instant: snapNext || reduceMotion() });
		snapNext = false;
		row.scrollIntoView({ block: 'nearest' });
	});

	// Open: remember focus, reset, focus the input, lock page scroll. Close: restore focus.
	$effect(() => {
		if (!palette.open) return;
		returnFocus = document.activeElement as HTMLElement | null;
		query = '';
		active = 0;
		snapNext = true;
		tick().then(() => input?.focus());
		const root = document.documentElement;
		const previous = root.style.overflow;
		root.style.overflow = 'hidden';
		return () => {
			root.style.overflow = previous;
			returnFocus?.focus?.();
		};
	});

	function close() {
		palette.open = false;
	}

	function choose(command: Command | undefined) {
		if (!command) return;
		close();
		command.run();
	}

	function onWindowKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			palette.open = !palette.open;
		} else if (e.key === 'Escape' && palette.open) {
			e.preventDefault();
			close();
		}
	}

	function onPanelKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!rows.length) return;
			active = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(rows[active]);
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} />

{#if palette.open}
	<button
		type="button"
		aria-label="Close search"
		onclick={close}
		in:fade={{ duration: 180 }}
		out:fade={{ duration: 120 }}
		class="fixed inset-0 z-[100] cursor-default border-0 bg-ink-950/30 p-0 backdrop-blur-md backdrop-saturate-150"
	></button>

	<div class="pointer-events-none fixed inset-x-4 top-[14vh] bottom-4 z-[100] flex items-start justify-center">
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			tabindex="-1"
			onkeydown={onPanelKey}
			in:pop={{ duration: 220, scale: 0.97, y: -8 }}
			out:pop={{ duration: 120, scale: 0.97, y: -8 }}
			class="pointer-events-auto w-full max-w-xl overflow-hidden border border-border bg-bg-raised shadow-2xl"
		>
			<div class="flex items-center gap-3 border-b border-border px-4">
				<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-fg-faint" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
				</svg>
				<input
					bind:this={input}
					bind:value={query}
					placeholder="Search players, teams, matches…"
					role="combobox"
					aria-expanded="true"
					aria-controls="command-list"
					aria-activedescendant={rows.length ? `command-${active}` : undefined}
					aria-autocomplete="list"
					class="h-12 min-w-0 flex-1 border-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-faint sm:text-sm"
				/>
				<kbd class="hidden border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-faint sm:inline-block">ESC</kbd>
			</div>

			<div bind:this={listEl} id="command-list" role="listbox" aria-label="Results" class="relative max-h-[60vh] overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">
				{#if rows.length === 0}
					<div class="p-8 text-center text-sm text-fg-faint">No matches for “{query}”</div>
				{:else}
					<span
						aria-hidden="true"
						class="pointer-events-none absolute inset-x-2 border-l-2 border-accent-ink bg-bg-sunken"
						style="top: {highlight.current.top}px; height: {highlight.current.height}px"
					></span>
					{#each groups as [group, list] (group)}
						<div class="mb-1 last:mb-0">
							<div aria-hidden="true" class="px-2 py-1.5 text-[10px] font-medium tracking-[0.12em] text-fg-faint uppercase">{group}</div>
							{#each list as command (command.id)}
								{@const index = rows.indexOf(command)}
								<button
									type="button"
									id="command-{index}"
									role="option"
									aria-selected={index === active}
									data-index={index}
									tabindex="-1"
									onpointermove={() => (active = index)}
									onclick={() => choose(command)}
									class="relative flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 py-2 text-left text-sm {index === active
										? 'text-fg'
										: 'text-fg-soft'}"
								>
									{#if command.visual?.kind === 'player'}
										<PlayerAvatar playerId={command.visual.playerId} name={command.visual.name} hasHeadshot={command.visual.hasHeadshot} size={24} />
									{:else if command.visual?.kind === 'team'}
										<TeamLogo teamId={command.visual.teamId} name={command.visual.name} size={24} />
									{:else if command.visual?.kind === 'match'}
										<span class="flex shrink-0 items-center -space-x-1.5">
											<TeamLogo teamId={command.visual.home.id} name={command.visual.home.name} size={22} />
											<TeamLogo teamId={command.visual.away.id} name={command.visual.away.name} size={22} />
										</span>
									{/if}
									<span class="min-w-0 flex-1 truncate">{command.label}</span>
									{#if command.hint}
										<span class="shrink-0 font-mono text-[11px] text-fg-faint">{command.hint}</span>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>

			<div class="hidden items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-fg-faint sm:flex">
				<span><kbd class="font-mono">↑↓</kbd> move</span>
				<span><kbd class="font-mono">↵</kbd> open</span>
				<span class="ml-auto"><kbd class="font-mono">Ctrl/⌘ K</kbd> toggle</span>
			</div>
		</div>
	</div>
{/if}
