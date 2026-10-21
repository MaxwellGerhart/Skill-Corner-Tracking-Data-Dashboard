<script lang="ts" module>
	import type { Layers } from '../../match/render';

	export const DEFAULT_LAYERS: Layers = {
		numbers: true,
		trails: false,
		voronoi: false,
		pitchControl: false,
		formation: false,
		orientation: false,
		visionCones: false,
		camera: true,
		ghosting: true,
		runs: true,
		follow: false,
		vertical: false
	};

	type OverlayKey = 'trails' | 'voronoi' | 'pitchControl' | 'formation' | 'orientation' | 'visionCones' | 'runs' | 'camera' | 'ghosting';
	const off: Record<OverlayKey, boolean> = {
		trails: false,
		voronoi: false,
		pitchControl: false,
		formation: false,
		orientation: false,
		visionCones: false,
		runs: false,
		camera: false,
		ghosting: false
	};

	// Each preset sets every overlay, so switching presets never leaves stray layers on.
	const PRESETS: { label: string; layers: Record<OverlayKey, boolean> }[] = [
		{ label: 'Clean', layers: { ...off } },
		{ label: 'Broadcast', layers: { ...off, camera: true, ghosting: true, runs: true } },
		{ label: 'Movement', layers: { ...off, trails: true, orientation: true, runs: true } },
		{ label: 'Space', layers: { ...off, voronoi: true } },
		{ label: 'Control', layers: { ...off, pitchControl: true, formation: true } },
		{ label: 'Everything', layers: { ...off, trails: true, pitchControl: true, formation: true, orientation: true, visionCones: true, runs: true, camera: true, ghosting: true } }
	];

	const LAYER_GROUPS: { title: string; items: { key: keyof Layers; label: string; hint: string }[] }[] = [
		{
			title: 'Players',
			items: [
				{ key: 'numbers', label: 'Shirt numbers', hint: 'Number inside each player marker' },
				{ key: 'trails', label: 'Trails', hint: 'Path over the last 3 seconds' },
				{ key: 'orientation', label: 'Orientation', hint: 'Estimated facing direction (not measured)' },
				{ key: 'visionCones', label: 'Vision cones', hint: '60° cone along the estimated facing direction' },
				{ key: 'ghosting', label: 'Off-camera', hint: 'Dashed ring = extrapolated, not seen on the broadcast' }
			]
		},
		{
			title: 'Space',
			items: [
				{ key: 'voronoi', label: 'Voronoi', hint: 'Area closer to each player than to anyone else' },
				{ key: 'pitchControl', label: 'Pitch control', hint: 'Which team would reach each spot first' },
				{ key: 'formation', label: 'Formation lines', hint: 'Defence, midfield and attack lines' }
			]
		},
		{
			title: 'Broadcast',
			items: [
				{ key: 'camera', label: 'Camera footprint', hint: 'Area of the pitch visible on the TV feed' },
				{ key: 'follow', label: 'Camera follow', hint: 'Zoom to what the broadcast camera saw' }
			]
		},
		{
			title: 'Events & view',
			items: [
				{ key: 'runs', label: 'Off-ball runs', hint: 'SkillCorner-detected runs as they happen' },
				{ key: 'vertical', label: 'Vertical pitch', hint: 'Rotate the pitch 90°' }
			]
		}
	];

	const SPEEDS = [0.5, 1, 2, 4, 8];
	const TRAIL_FRAMES = 30;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { FrameStore } from '../../match/frames';
	import { aspectRatio, drawScene, Projection, readPalette, type Palette, type View } from '../../match/render';
	import { clockAt, headings, interpolate, periodAt, pitchControl, scoreAt, speed, velocities, RUN_LABELS, type Vec } from '../../match/models';
	import type { Frame, MatchEvents, MatchMeta, MatchRun } from '../../match/types';
	import TeamLogo from '../TeamLogo.svelte';
	import SlidingTabs from '../SlidingTabs.svelte';

	let {
		meta,
		events,
		frame = $bindable(),
		playing = $bindable(false),
		focusRun = null,
		highlightSlot = null
	}: {
		meta: MatchMeta;
		events: MatchEvents;
		frame: number;
		playing?: boolean;
		/** A run picked from the moments list: shown on its own instead of all live runs. */
		focusRun?: MatchRun | null;
		highlightSlot?: number | null;
	} = $props();

	let layers = $state<Layers>({ ...DEFAULT_LAYERS });
	let playbackSpeed = $state(1);
	let wrapper: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let cssWidth = $state(0);
	let maxHeight = $state(800);
	let loading = $state(true);
	let failed = $state(false);
	let hover = $state<{ x: number; y: number; slot: number; speed: number | null; detected: boolean } | null>(null);

	// svelte-ignore state_referenced_locally
	const store = new FrameStore(meta, `/api/matches/${meta.id}`);
	const firstFrame = $derived(meta.periods[0].startFrame);
	const lastFrame = $derived(meta.periods[meta.periods.length - 1].endFrame);
	const totalSpan = $derived(lastFrame - firstFrame);

	const aspect = $derived(aspectRatio(meta.pitch, layers.vertical));
	const canvasWidth = $derived(Math.max(0, Math.min(cssWidth, maxHeight / aspect)));
	const canvasHeight = $derived(canvasWidth * aspect);

	const whole = Math.floor;
	const score = $derived(scoreAt(meta.goals, whole(frame)));
	const clock = $derived(clockAt(meta, whole(frame)));
	const period = $derived(periodAt(meta, whole(frame)));

	let palette: Palette | null = null;
	let view: View = { cx: 0, cy: 0, zoom: 1 };
	let dirty = true;
	let lastProjection: Projection | null = null;
	let lastFrameData: Frame | null = null;

	// Anything the picture depends on marks it for redraw on the next animation frame.
	$effect(() => {
		void [frame, canvasWidth, canvasHeight, focusRun, highlightSlot];
		void Object.values(layers);
		dirty = true;
	});

	// Keep the chunks around the playhead loaded (a little behind for trails/velocity).
	$effect(() => {
		const f = whole(frame);
		loading = !store.has(f);
		store
			.ensure(f - TRAIL_FRAMES - 3, f + meta.chunkSize)
			.then(() => (loading = !store.has(whole(frame))))
			.catch(() => (failed = true));
	});

	function activeRuns(f: number): MatchRun[] {
		if (focusRun) return f >= focusRun.frameStart - 10 && f <= focusRun.frameEnd + 30 ? [focusRun] : [];
		return events.runs.filter((r) => f >= r.frameStart && f <= r.frameEnd + 10);
	}

	function trailsAt(f: number): (Vec | null)[][] {
		const out: (Vec | null)[][] = meta.players.map(() => []);
		for (let i = TRAIL_FRAMES; i >= 0; i -= 1) {
			const past = store.get(f - i);
			meta.players.forEach((_, slot) => out[slot].push(past?.players[slot] ?? null));
		}
		return out;
	}

	function followTarget(fr: Frame): View {
		if (fr.camera) {
			const xs = fr.camera.map((c) => c[0]);
			const ys = fr.camera.map((c) => c[1]);
			const clampX = (v: number) => Math.max(-meta.pitch.length / 2 - 3, Math.min(meta.pitch.length / 2 + 3, v));
			const clampY = (v: number) => Math.max(-meta.pitch.width / 2 - 3, Math.min(meta.pitch.width / 2 + 3, v));
			const x0 = clampX(Math.min(...xs));
			const x1 = clampX(Math.max(...xs));
			const y0 = clampY(Math.min(...ys));
			const y1 = clampY(Math.max(...ys));
			const along = meta.pitch.length + 6;
			const across = meta.pitch.width + 6;
			const zoom = Math.min(along / Math.max(x1 - x0 + 8, 1), across / Math.max(y1 - y0 + 8, 1));
			return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom: Math.max(1, Math.min(2.6, zoom)) };
		}
		if (fr.ball) return { cx: fr.ball.x, cy: fr.ball.y, zoom: 2 };
		return view;
	}

	function draw() {
		if (!canvas || !palette || canvasWidth <= 0) return;
		const f = whole(frame);
		const a = store.get(f);
		if (!a) return;
		const fr = interpolate(a, store.get(f + 1), frame - f);
		lastFrameData = fr;

		const target = layers.follow ? followTarget(fr) : { cx: 0, cy: 0, zoom: 1 };
		const ease = 0.12;
		view = {
			cx: view.cx + (target.cx - view.cx) * ease,
			cy: view.cy + (target.cy - view.cy) * ease,
			zoom: view.zoom + (target.zoom - view.zoom) * ease
		};
		const settling = Math.abs(target.cx - view.cx) > 0.05 || Math.abs(target.cy - view.cy) > 0.05 || Math.abs(target.zoom - view.zoom) > 0.002;

		const dpr = window.devicePixelRatio || 1;
		const w = Math.round(canvasWidth * dpr);
		const h = Math.round(canvasHeight * dpr);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d')!;
		const proj = new Projection(canvasWidth, canvasHeight, meta.pitch, view, layers.vertical);
		lastProjection = proj;

		const needsVelocity = layers.orientation || layers.visionCones || layers.pitchControl;
		const vel = needsVelocity ? velocities(store, f, meta.fps) : null;
		drawScene(
			ctx,
			proj,
			dpr,
			{
				meta,
				frame: fr,
				trails: layers.trails ? trailsAt(f) : null,
				headings: vel && (layers.orientation || layers.visionCones) ? headings(fr, vel) : null,
				control: vel && layers.pitchControl ? pitchControl(fr, vel, meta.players, meta.pitch) : null,
				activeRuns: layers.runs ? activeRuns(f) : [],
				highlightSlot
			},
			layers,
			palette
		);
		dirty = settling;
	}

	onMount(() => {
		if (wrapper && wrapper.clientWidth < 640) layers.vertical = true;
		palette = readPalette(document.documentElement);
		store.onload = () => (dirty = true);

		const resize = new ResizeObserver(() => {
			cssWidth = wrapper?.clientWidth ?? 0;
			maxHeight = Math.max(320, window.innerHeight * 0.78);
		});
		if (wrapper) resize.observe(wrapper);

		// Re-read colours when the theme flips (toggle or OS setting).
		const refresh = () => {
			palette = readPalette(document.documentElement);
			dirty = true;
		};
		const themeObserver = new MutationObserver(refresh);
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		media.addEventListener('change', refresh);

		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			if (playing) {
				const next = frame + dt * meta.fps * playbackSpeed;
				if (next >= lastFrame) {
					frame = lastFrame;
					playing = false;
				} else if (store.has(Math.floor(next)) && store.has(Math.floor(next) + 1)) {
					frame = next;
				}
			}
			if (dirty) draw();
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			resize.disconnect();
			themeObserver.disconnect();
			media.removeEventListener('change', refresh);
			store.onload = null;
		};
	});

	function seekBy(seconds: number) {
		frame = Math.max(firstFrame, Math.min(lastFrame, whole(frame) + seconds * meta.fps));
	}

	function togglePlay() {
		if (!playing && frame >= lastFrame) frame = firstFrame;
		playing = !playing;
	}

	function applyPreset(preset: Record<OverlayKey, boolean>) {
		layers = { ...layers, ...preset };
	}

	function handlePointer(e: PointerEvent) {
		if (!lastProjection || !lastFrameData || !canvas) return;
		const rect = canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		let best: { slot: number; d: number } | null = null;
		lastFrameData.players.forEach((p, slot) => {
			if (!p) return;
			const [px, py] = lastProjection!.toScreen(p.x, p.y);
			const d = Math.hypot(px - sx, py - sy);
			if (d < 16 && (!best || d < best.d)) best = { slot, d };
		});
		if (!best) {
			hover = null;
			return;
		}
		const slot = (best as { slot: number }).slot;
		const vel = velocities(store, whole(frame), meta.fps)[slot] ?? null;
		const p = lastFrameData.players[slot]!;
		const [px, py] = lastProjection.toScreen(p.x, p.y);
		hover = { x: px, y: py, slot, speed: speed(vel), detected: p.detected };
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return;
		if (e.key === ' ') {
			e.preventDefault();
			togglePlay();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			seekBy(e.shiftKey ? 10 : 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			seekBy(e.shiftKey ? -10 : -1);
		}
	}

	const pct = (f: number) => ((f - firstFrame) / totalSpan) * 100;
	const placedGoals = $derived(meta.goals.filter((g): g is typeof g & { frame: number } => g.frame !== null));
	const unplacedGoals = $derived(meta.goals.length - placedGoals.length);
	const halfTime = $derived(meta.periods.length > 1 ? pct(meta.periods[1].startFrame) : null);
	const hoverPlayer = $derived(hover ? meta.players[hover.slot] : null);
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="chamfer-sm grid gap-0 border border-border bg-bg-raised" aria-label="Tracking data viewer">
	<!-- Scoreboard -->
	<div class="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
		<div class="flex items-center gap-3 text-sm sm:gap-4">
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full bg-team-home" aria-hidden="true"></span>
				<TeamLogo teamId={meta.home.id} name={meta.home.name} size={28} />
				<span class="font-medium text-fg">{meta.home.shortName}</span>
			</span>
			<span class="bg-ink-950 px-3 py-1 font-mono text-lg font-medium text-paper-50 tabular-nums">{score.home} – {score.away}</span>
			<span class="flex items-center gap-2">
				<span class="font-medium text-fg">{meta.away.shortName}</span>
				<TeamLogo teamId={meta.away.id} name={meta.away.name} size={28} />
				<span class="h-3 w-3 rounded-full bg-team-away" aria-hidden="true"></span>
			</span>
		</div>
		<div class="flex items-center gap-3 text-xs text-fg-faint">
			{#if failed}
				<span class="text-critical">Couldn't load tracking data</span>
			{:else if loading}
				<span>Loading tracking…</span>
			{/if}
			<span class="font-mono text-base text-fg tabular-nums">{clock}</span>
			<span class="tracking-[0.1em] uppercase">{period === 2 ? '2nd half' : period === 1 ? '1st half' : '—'}</span>
		</div>
	</div>

	<!-- Pitch -->
	<div bind:this={wrapper} class="relative grid justify-items-center bg-pitch px-0 py-0">
		<canvas
			bind:this={canvas}
			style="width: {canvasWidth}px; height: {canvasHeight}px"
			class="block touch-none"
			aria-label="Animated pitch showing every player and the ball. Use the controls below, or space to play and arrow keys to step."
			onpointermove={handlePointer}
			onpointerleave={() => (hover = null)}
		></canvas>
		{#if hover && hoverPlayer}
			{@const flipX = hover.x > canvasWidth - 190}
			<div
				class="pointer-events-none absolute z-10 grid min-w-40 gap-0.5 border border-border bg-bg-raised px-3 py-2 text-xs shadow-sm"
				style="left: calc(50% - {canvasWidth / 2}px + {hover.x}px); top: {hover.y}px; transform: translate({flipX ? 'calc(-100% - 14px)' : '14px'}, -50%)"
			>
				<span class="flex items-center gap-1.5 font-medium text-fg">
					<span class="h-2 w-2 rounded-full {hoverPlayer.team === 'home' ? 'bg-team-home' : 'bg-team-away'}"></span>
					#{hoverPlayer.number} {hoverPlayer.shortName}
				</span>
				<span class="text-fg-soft">{hoverPlayer.role} · {hoverPlayer.team === 'home' ? meta.home.shortName : meta.away.shortName}</span>
				{#if hover.speed !== null}
					<span class="font-mono text-fg-soft tabular-nums">{(hover.speed * 3.6).toFixed(1)} km/h</span>
				{/if}
				{#if !hover.detected}
					<span class="text-fg-faint">Off camera (extrapolated)</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Transport -->
	<div class="grid gap-3 border-t border-border px-4 py-4 sm:px-6">
		<div class="flex flex-wrap items-center gap-2">
			<button type="button" onclick={() => seekBy(-5)} class="h-9 cursor-pointer border border-border bg-transparent px-3 text-xs text-fg-soft hover:border-fg-soft hover:text-fg" aria-label="Back 5 seconds">−5s</button>
			<button
				type="button"
				onclick={togglePlay}
				class="btn-accent h-9 min-w-20 cursor-pointer border-0 px-4 text-[11px] font-medium tracking-[0.12em] uppercase"
				aria-label={playing ? 'Pause' : 'Play'}
			>
				{playing ? 'Pause' : 'Play'}
			</button>
			<button type="button" onclick={() => seekBy(5)} class="h-9 cursor-pointer border border-border bg-transparent px-3 text-xs text-fg-soft hover:border-fg-soft hover:text-fg" aria-label="Forward 5 seconds">+5s</button>
			<div class="ml-auto flex items-center gap-2 text-xs text-fg-faint">
				<span aria-hidden="true">Speed</span>
				<SlidingTabs label="Playback speed" bind:value={playbackSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} />
			</div>
		</div>

		<div class="relative h-8">
			<div class="absolute inset-x-0 top-3.5 h-1 bg-bg-sunken"></div>
			<div
				class="absolute top-3.5 left-0 h-1"
				style="width: {pct(frame)}%; background: linear-gradient(90deg, var(--color-accent), var(--color-accent-glow))"
			></div>
			{#if halfTime !== null}
				<div class="absolute top-1 h-6 w-px bg-fg-faint" style="left: {halfTime}%" title="Half-time"></div>
			{/if}
			{#each events.shots.filter((s) => !s.goal) as shot (shot.frame)}
				<div
					class="absolute top-2 h-4 w-0.5 {shot.team === 'home' ? 'bg-team-home' : 'bg-team-away'}"
					style="left: {pct(shot.frame)}%"
					title="{shot.minute}' {shot.player} — shot"
				></div>
			{/each}
			<!-- Goals come from the goal list, not shots: an own goal has no shot by the scoring side. -->
			{#each placedGoals as goal (goal.frame)}
				<div
					class="absolute top-0 h-8 w-0.5 {goal.team === 'home' ? 'bg-team-home' : 'bg-team-away'}"
					style="left: {pct(goal.frame)}%"
					title="{goal.minute}' {goal.player ?? 'Goal (scorer not recorded)'} — goal"
				></div>
			{/each}
			<input
				type="range"
				min={firstFrame}
				max={lastFrame}
				step="1"
				value={whole(frame)}
				oninput={(e) => (frame = Number(e.currentTarget.value))}
				class="timeline absolute inset-0 h-8 w-full cursor-pointer"
				aria-label="Match timeline"
				aria-valuetext={clock}
			/>
		</div>
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-faint">
			<span class="flex items-center gap-1.5"><span class="h-3 w-0.5 bg-fg-faint"></span>Shot</span>
			<span class="flex items-center gap-1.5"><span class="h-4 w-0.5 bg-fg-faint"></span>Goal (tall)</span>
			<span>Space to play · ← → step 1s · Shift for 10s</span>
			{#if unplacedGoals > 0}
				<span>{unplacedGoals === 1 ? '1 goal' : `${unplacedGoals} goals`} in the final score couldn't be placed on the timeline</span>
			{/if}
		</div>
	</div>

	<!-- Layers -->
	<div class="grid gap-4 border-t border-border px-4 py-4 sm:px-6">
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-1 text-[10px] tracking-[0.14em] text-fg-faint uppercase">Presets</span>
			{#each PRESETS as preset (preset.label)}
				<button type="button" onclick={() => applyPreset(preset.layers)} class="cursor-pointer border border-border bg-transparent px-2.5 py-1 text-xs text-fg-soft hover:border-fg-soft hover:text-fg">
					{preset.label}
				</button>
			{/each}
		</div>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each LAYER_GROUPS as group (group.title)}
				<fieldset class="m-0 grid content-start gap-1.5 border-0 p-0">
					<legend class="mb-1.5 p-0 text-[10px] tracking-[0.14em] text-fg-faint uppercase">{group.title}</legend>
					{#each group.items as item (item.key)}
						<button
							type="button"
							aria-pressed={layers[item.key]}
							onclick={() => (layers[item.key] = !layers[item.key])}
							title={item.hint}
							class="flex cursor-pointer items-center gap-2 border px-2.5 py-1.5 text-left text-xs {layers[item.key]
								? 'border-accent-ink bg-bg-sunken text-fg'
								: 'border-border bg-transparent text-fg-soft hover:border-fg-soft hover:text-fg'}"
						>
							<span class="grid h-3.5 w-3.5 shrink-0 place-items-center border {layers[item.key] ? 'border-accent-ink bg-accent-ink' : 'border-fg-faint'}">
								{#if layers[item.key]}<span class="text-[9px] leading-none text-paper-50">✓</span>{/if}
							</span>
							{item.label}
						</button>
					{/each}
				</fieldset>
			{/each}
		</div>

		<!-- Legend for the active encodings -->
		<div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs text-fg-soft">
			<span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-team-home"></span>{meta.home.shortName} (home)</span>
			<span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-team-away"></span>{meta.away.shortName} (away)</span>
			<span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-fg"></span>Ball (grows with height)</span>
			{#if layers.ghosting}
				<span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full border-2 border-dashed border-fg-faint"></span>Off camera</span>
			{/if}
			{#if layers.pitchControl}
				<span class="flex items-center gap-2">
					<span>{meta.away.acronym}</span>
					<span class="h-2.5 w-28" style="background: linear-gradient(90deg, var(--color-team-away), var(--color-pitch), var(--color-team-home)); outline: 1px solid var(--color-border)"></span>
					<span>{meta.home.acronym} control</span>
				</span>
			{/if}
			{#if layers.runs && focusRun}
				<span class="flex items-center gap-1.5">Showing: {focusRun.player} · {RUN_LABELS[focusRun.subtype] ?? focusRun.subtype}</span>
			{/if}
		</div>
	</div>
</section>

<style>
	.timeline {
		appearance: none;
		background: transparent;
		margin: 0;
	}
	.timeline::-webkit-slider-runnable-track {
		height: 2rem;
		background: transparent;
	}
	.timeline::-moz-range-track {
		height: 2rem;
		background: transparent;
	}
	.timeline::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		margin-top: calc(1rem - 7px);
		border-radius: 50%;
		background: var(--color-accent);
		border: 2px solid var(--color-ink-950);
	}
	.timeline::-moz-range-thumb {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-accent);
		border: 2px solid var(--color-ink-950);
	}
	.timeline:focus-visible {
		outline: 2px solid var(--color-accent-ink);
		outline-offset: 2px;
	}
</style>
