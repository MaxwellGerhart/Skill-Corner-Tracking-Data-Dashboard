<script lang="ts">
	import { Spring } from 'svelte/motion';
	import { reduceMotion } from '../utils/motion';

	/*
	 * Dropdown replacing the native <select>, whose open list can't be styled (it renders as
	 * the OS's white menu, even in dark mode). Adapted from beUI's select
	 * (github.com/starc007/ui-components, MIT): the panel unfolds from the trigger on a
	 * slightly bouncy spring, separates from it with a small gap, and its options stagger in
	 * with a short fade/blur. It flips above the trigger when there's no room below.
	 *
	 * Keyboard follows the ARIA select-only combobox pattern (focus stays on the trigger): Enter/Space/↓
	 * open, ↑↓ Home End move, Enter selects, Esc closes, and typing jumps to an option.
	 */
	type Option = { value: string; label: string };

	let {
		value = $bindable(),
		options,
		label,
		class: className = ''
	}: {
		value: string;
		options: Option[];
		/** Visible label above the trigger (also its accessible name). */
		label: string;
		/** Width etc. for the trigger, e.g. "w-48". */
		class?: string;
	} = $props();

	const uid = $props.id();
	let open = $state(false);
	let active = $state(0);
	let placement = $state<'bottom' | 'top'>('bottom');
	let root = $state<HTMLDivElement>();
	let trigger = $state<HTMLButtonElement>();
	let list = $state<HTMLDivElement>();
	let contentHeight = $state(0);
	// Bumped on each open so the option stagger replays.
	let openCount = $state(0);

	const selected = $derived(options.find((o) => o.value === value));
	const selectedIndex = $derived(Math.max(0, options.findIndex((o) => o.value === value)));

	// Panel height: unfolds from 0 on a spring with a little overshoot each time it opens.
	// Closing only fades (height is left alone, so the content doesn't collapse mid-fade).
	const height = new Spring(0, { stiffness: 0.2, damping: 0.62 });
	$effect(() => {
		if (!open) return;
		height.set(contentHeight, { instant: reduceMotion() });
	});

	function show() {
		if (open) return;
		active = selectedIndex;
		if (trigger) {
			const rect = trigger.getBoundingClientRect();
			const needed = Math.min(options.length * 34 + 16, 300);
			placement = window.innerHeight - rect.bottom < needed + 16 && rect.top > window.innerHeight - rect.bottom ? 'top' : 'bottom';
		}
		openCount++;
		height.set(0, { instant: true });
		open = true;
	}

	function hide() {
		open = false;
	}

	function choose(index: number) {
		const option = options[index];
		if (option) value = option.value;
		hide();
		trigger?.focus();
	}

	// Keep the active option scrolled into view inside long lists.
	$effect(() => {
		if (!open || !list) return;
		list.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	// Click outside closes.
	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (root && !root.contains(e.target as Node)) hide();
		};
		window.addEventListener('pointerdown', onDown);
		return () => window.removeEventListener('pointerdown', onDown);
	});

	let typed = '';
	let typedTimer: ReturnType<typeof setTimeout> | undefined;
	function typeahead(char: string) {
		typed += char.toLowerCase();
		clearTimeout(typedTimer);
		typedTimer = setTimeout(() => (typed = ''), 600);
		const start = typed.length === 1 ? active + 1 : active;
		for (let k = 0; k < options.length; k++) {
			const i = (start + k) % options.length;
			if (options[i].label.toLowerCase().startsWith(typed)) {
				if (open) active = i;
				else value = options[i].value;
				return;
			}
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				show();
			} else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
				typeahead(e.key);
			}
			return;
		}
		if (e.key === 'ArrowDown') active = Math.min(options.length - 1, active + 1);
		else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
		else if (e.key === 'Home') active = 0;
		else if (e.key === 'End') active = options.length - 1;
		else if (e.key === 'Enter' || e.key === ' ') choose(active);
		else if (e.key === 'Escape' || e.key === 'Tab') {
			if (e.key === 'Escape') e.preventDefault();
			hide();
			return;
		} else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
			typeahead(e.key);
			return;
		} else return;
		e.preventDefault();
	}
</script>

<div bind:this={root} class="grid gap-1 text-xs text-fg-soft">
	<span id="{uid}-label">{label}</span>
	<div class="relative {className}">
	<button
		bind:this={trigger}
		type="button"
		id="{uid}-trigger"
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls="{uid}-list"
		aria-labelledby="{uid}-label {uid}-trigger"
		aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
		onclick={() => (open ? hide() : show())}
		{onkeydown}
		class="flex w-full cursor-pointer items-center justify-between gap-3 border bg-bg px-3 py-2 text-left text-sm text-fg transition-colors {open
			? 'border-accent-ink'
			: 'border-border hover:border-fg-faint'} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink"
	>
		<span class="truncate">{selected?.label ?? ''}</span>
		<svg
			viewBox="0 0 24 24"
			class="chevron h-3.5 w-3.5 shrink-0 text-fg-faint"
			class:flipped={open}
			fill="none"
			stroke="currentColor"
			stroke-width="2.25"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	<div
		id="{uid}-list"
		role="listbox"
		aria-labelledby="{uid}-label"
		aria-hidden={!open}
		inert={!open}
		class="panel absolute left-0 z-50 w-max max-w-[min(22rem,90vw)] min-w-full overflow-hidden border border-border bg-bg-raised shadow-xl {placement ===
		'top'
			? 'bottom-full'
			: 'top-full'}"
		class:open
		class:top={placement === 'top'}
		style="height: {height.current}px"
	>
		<div bind:this={list} bind:offsetHeight={contentHeight} class="max-h-72 overflow-y-auto p-1 [scrollbar-width:thin]">
			{#key openCount}
				{#each options as option, i (option.value)}
					{@const isSelected = option.value === value}
					<!-- svelte-ignore a11y_click_events_have_key_events (keyboard is handled on the trigger) -->
					<div
						id="{uid}-opt-{i}"
						role="option"
						tabindex="-1"
						aria-selected={isSelected}
						data-index={i}
						onpointermove={() => (active = i)}
						onclick={() => choose(i)}
						class="item flex cursor-pointer items-center justify-between gap-4 px-2.5 py-1.5 text-sm whitespace-nowrap {i === active
							? 'bg-bg-sunken text-fg'
							: 'text-fg-soft'}"
						style="animation-delay: {Math.min(i, 8) * 30 + 40}ms"
					>
						{option.label}
						{#if isSelected}
							<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 text-accent-ink" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
								<path d="m5 12 5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{/if}
					</div>
				{/each}
			{/key}
		</div>
	</div>
	</div>
</div>

<style>
	/* Chevron flips with a small bounce. */
	.chevron {
		transition: transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.chevron.flipped {
		transform: rotate(180deg);
	}

	/* Closed: flush against the trigger and invisible. Open: fades in and separates by a
	   small gap with a springy ease, on whichever side faces the trigger. */
	.panel {
		opacity: 0;
		margin-top: 0;
		pointer-events: none;
		transition:
			opacity 140ms ease,
			margin 200ms ease;
	}
	.panel.top {
		margin-bottom: 0;
	}
	.panel.open {
		opacity: 1;
		pointer-events: auto;
		margin-top: 6px;
		transition:
			opacity 160ms ease,
			margin 520ms cubic-bezier(0.34, 1.56, 0.64, 1) 90ms;
	}
	.panel.open.top {
		margin-top: 0;
		margin-bottom: 6px;
	}

	/* Options stagger in: drop, fade and un-blur (delay set per item). */
	.panel.open .item {
		animation: item-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes item-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
			filter: blur(3px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron,
		.panel,
		.panel.open {
			transition: opacity 100ms ease;
		}
		.panel.open .item {
			animation: none;
		}
	}
</style>
