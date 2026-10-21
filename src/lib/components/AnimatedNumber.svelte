<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { easeOut, reduceMotion } from '../utils/motion';

	/*
	 * Counts up from 0 the first time it scrolls into view, then glides between values
	 * whenever `value` changes (e.g. a filter narrows the sample). Ported from beUI's
	 * animated-number (github.com/starc007/ui-components, MIT).
	 */
	let {
		value,
		format = (n: number) => Math.round(n).toLocaleString(),
		duration = 1200,
		class: className = ''
	}: {
		value: number;
		format?: (n: number) => string;
		/** Milliseconds. */
		duration?: number;
		class?: string;
	} = $props();

	const tween = new Tween(0, { easing: easeOut });
	let el = $state<HTMLSpanElement>();
	let inView = $state(false);

	$effect(() => {
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					inView = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.6 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});

	$effect(() => {
		const target = value;
		if (!inView) return;
		tween.set(target, { duration: reduceMotion() || !Number.isFinite(target) ? 0 : duration });
	});
</script>

<!-- Screen readers get the settled value, not every intermediate frame. Before it scrolls
     into view (and in the server render) the real value shows, so nothing reads as 0. -->
<span bind:this={el} class="tabular-nums {className}" aria-hidden="true">{format(inView ? tween.current : value)}</span>
<span class="sr-only">{format(value)}</span>
