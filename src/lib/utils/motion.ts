import { cubicOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';

/*
 * Shared motion tokens, adapted from beUI (github.com/starc007/ui-components, MIT,
 * © Saurabh Chauhan). beUI drives Motion's physical springs (stiffness/damping/mass);
 * Svelte's Spring uses normalised 0-1 stiffness/damping, so these are tuned by eye to
 * the same feel rather than converted.
 */

/** beUI's EASE_OUT, cubic-bezier(0.16, 1, 0.3, 1): a fast start that settles softly. */
export function easeOut(t: number): number {
	return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Shared-layout glides: pills and indicators moving between positions, no overshoot. */
export const SPRING_LAYOUT = { stiffness: 0.16, damping: 0.82 };

/** Tracks rapid arrow-key movement (command palette highlight), so a little tighter. */
export const SPRING_CURSOR = { stiffness: 0.24, damping: 0.86 };

/** Pointer-follow for tooltips: smooth, but never lags far behind the cursor. */
export const SPRING_FOLLOW = { stiffness: 0.22, damping: 0.78 };

/** True when the viewer asked the OS for reduced motion. */
export function reduceMotion(): boolean {
	return prefersReducedMotion.current;
}

/**
 * Overlay entrance/exit: fade with a slight scale (and optional drop), the beUI tooltip
 * and panel pattern. Collapses to a plain short fade under reduced motion.
 */
export function pop(
	_node: Element,
	{ duration = 180, scale = 0.94, y = 0 }: { duration?: number; scale?: number; y?: number } = {}
) {
	const still = reduceMotion();
	return {
		duration: still ? Math.min(duration, 100) : duration,
		easing: still ? cubicOut : easeOut,
		css: (t: number) => {
			if (still) return `opacity: ${t}`;
			const s = scale + (1 - scale) * t;
			return `opacity: ${t}; transform: translateY(${(1 - t) * y}px) scale(${s})`;
		}
	};
}
