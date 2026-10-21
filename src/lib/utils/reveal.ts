import { reduceMotion } from './motion';

/*
 * Scroll reveal, after beUI's scroll-reveal (github.com/starc007/ui-components, MIT):
 * elements fade up and un-blur as they enter the viewport. Elements that arrive in the
 * same batch (a page load, or a fast scroll) stagger by `step` ms each, capped so a long
 * batch never makes the last card wait. The hidden state is applied only once this runs
 * in the browser, so the server render and no-JS view show everything.
 *
 * Styles live in layout.css under [data-reveal].
 */
let observer: IntersectionObserver | null = null;

function getObserver(step: number, cap: number): IntersectionObserver {
	observer ??= new IntersectionObserver(
		(entries) => {
			let i = 0;
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const el = entry.target as HTMLElement;
				el.style.setProperty('--reveal-delay', `${Math.min(i++, cap) * step}ms`);
				el.dataset.reveal = 'shown';
				observer?.unobserve(el);
			}
		},
		{ rootMargin: '0px 0px -40px 0px', threshold: 0.1 }
	);
	return observer;
}

export function reveal(node: HTMLElement, { step = 45, cap = 10 }: { step?: number; cap?: number } = {}) {
	if (reduceMotion()) return;
	node.dataset.reveal = 'pending';
	const io = getObserver(step, cap);
	io.observe(node);
	return {
		destroy() {
			io.unobserve(node);
		}
	};
}
