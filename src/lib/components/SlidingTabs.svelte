<script lang="ts" generics="T extends string | number">
	import { Spring } from 'svelte/motion';
	import { SPRING_LAYOUT, reduceMotion } from '../utils/motion';

	/*
	 * Single-choice control whose selection indicator glides between options. Adapted from
	 * beUI's tabs (github.com/starc007/ui-components, MIT), including its label inversion:
	 * in the "segment" variant each label is drawn twice, and the copy coloured for the
	 * indicator is clipped to exactly where the indicator overlaps it mid-glide, so text
	 * flips colour as the block passes under it rather than snapping at the end.
	 *
	 * - segment: a solid block behind the selected option (speed, sort direction).
	 * - underline: an accent bar under the selected tab (tab strips).
	 */
	type Option = { value: T; label: string; count?: number };

	let {
		options,
		value = $bindable(),
		variant = 'segment',
		label,
		class: className = ''
	}: {
		options: Option[];
		value: T;
		variant?: 'segment' | 'underline';
		/** Accessible name for the group. */
		label: string;
		class?: string;
	} = $props();

	let list = $state<HTMLDivElement>();
	let buttons = $state<HTMLButtonElement[]>([]);
	// Each option's box within the list, refreshed on resize (fonts, wrapping, counts).
	let boxes = $state<{ left: number; width: number }[]>([]);

	const indicator = new Spring({ left: 0, width: 0 }, SPRING_LAYOUT);
	let placed = false;

	function measure() {
		boxes = buttons.map((b) => ({ left: b.offsetLeft, width: b.offsetWidth }));
	}

	$effect(() => {
		if (!list) return;
		void options.length;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		for (const b of buttons) if (b) observer.observe(b);
		return () => observer.disconnect();
	});

	const selectedIndex = $derived(options.findIndex((o) => o.value === value));

	$effect(() => {
		const box = boxes[selectedIndex];
		if (!box) return;
		// First placement snaps; later changes glide (or snap under reduced motion).
		indicator.set(box, { instant: !placed || reduceMotion() });
		placed = true;
	});

	/** clip-path for the inverted label copy: only the part currently under the indicator. */
	function clipFor(i: number): string {
		const box = boxes[i];
		if (!box) return 'inset(0 100% 0 0)';
		const { left, width } = indicator.current;
		const l = Math.max(0, Math.min(box.width, left - box.left));
		const r = Math.max(0, Math.min(box.width, box.left + box.width - (left + width)));
		return l + r >= box.width ? 'inset(0 100% 0 0)' : `inset(0 ${r}px 0 ${l}px)`;
	}

	function onkeydown(e: KeyboardEvent) {
		const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		const jump = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : null;
		if (!step && jump === null) return;
		e.preventDefault();
		const next = jump ?? (selectedIndex + step + options.length) % options.length;
		value = options[next].value;
		buttons[next]?.focus();
	}
</script>

<div
	bind:this={list}
	role={variant === 'underline' ? 'tablist' : 'radiogroup'}
	aria-label={label}
	tabindex="-1"
	{onkeydown}
	class="relative inline-flex {variant === 'segment' ? 'border border-border bg-bg-raised p-0.5' : 'gap-1 border-b border-border'} {className}"
>
	{#if variant === 'segment'}
		<span
			aria-hidden="true"
			class="absolute top-0.5 bottom-0.5 bg-fg"
			style="left: {indicator.current.left}px; width: {indicator.current.width}px"
		></span>
	{:else}
		<span
			aria-hidden="true"
			class="absolute -bottom-px h-0.5 bg-accent-ink"
			style="left: {indicator.current.left}px; width: {indicator.current.width}px"
		></span>
	{/if}

	{#each options as option, i (option.value)}
		{@const selected = option.value === value}
		<button
			bind:this={buttons[i]}
			type="button"
			role={variant === 'underline' ? 'tab' : 'radio'}
			aria-selected={variant === 'underline' ? selected : undefined}
			aria-checked={variant === 'segment' ? selected : undefined}
			tabindex={selected ? 0 : -1}
			onclick={() => (value = option.value)}
			class="relative cursor-pointer border-0 bg-transparent whitespace-nowrap {variant === 'segment'
				? 'h-8 px-3 font-mono text-xs'
				: 'px-3 py-2 text-xs'} {selected ? 'text-fg' : 'text-fg-faint hover:text-fg'} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink"
		>
			<span>
				{option.label}
				{#if option.count !== undefined}<span class="font-mono text-fg-faint tabular-nums">{option.count}</span>{/if}
			</span>
			{#if variant === 'segment'}
				<!-- Inverted copy, clipped to the indicator's overlap. -->
				<span aria-hidden="true" class="absolute inset-0 grid place-items-center text-bg" style="clip-path: {clipFor(i)}">
					{option.label}
				</span>
			{/if}
		</button>
	{/each}
</div>
