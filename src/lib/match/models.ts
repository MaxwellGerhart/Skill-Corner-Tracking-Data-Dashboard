import type { Frame, Line, MatchGoal, MatchMeta, MatchPlayer, Side } from './types';
import type { FrameStore } from './frames';

export interface Vec {
	x: number;
	y: number;
}

/** Linear blend between two consecutive frames, for smooth slow-motion playback. */
export function interpolate(a: Frame, b: Frame | null, t: number): Frame {
	if (!b || t <= 0) return a;
	const mix = (p: number, q: number) => p + (q - p) * t;
	return {
		ball: a.ball && b.ball ? { x: mix(a.ball.x, b.ball.x), y: mix(a.ball.y, b.ball.y), z: mix(a.ball.z, b.ball.z), detected: a.ball.detected } : a.ball,
		camera: a.camera && b.camera ? a.camera.map(([x, y], i) => [mix(x, b.camera![i][0]), mix(y, b.camera![i][1])] as [number, number]) : a.camera,
		possession: a.possession,
		players: a.players.map((p, i) => {
			const q = b.players[i];
			return p && q ? { x: mix(p.x, q.x), y: mix(p.y, q.y), detected: p.detected } : p;
		})
	};
}

const VELOCITY_HALF_WINDOW = 3; // frames either side (0.6 s span at 10 fps)

/** Per-slot velocity in m/s from a centred finite difference; null where unknown. */
export function velocities(store: FrameStore, frame: number, fps: number): (Vec | null)[] {
	const before = store.get(frame - VELOCITY_HALF_WINDOW) ?? store.get(frame);
	const after = store.get(frame + VELOCITY_HALF_WINDOW) ?? store.get(frame);
	const now = store.get(frame);
	if (!now || !before || !after) return now ? now.players.map(() => null) : [];
	const span = (before === now ? 0 : VELOCITY_HALF_WINDOW) + (after === now ? 0 : VELOCITY_HALF_WINDOW);
	if (span === 0) return now.players.map(() => null);
	const dt = span / fps;
	return now.players.map((_, i) => {
		const p = before.players[i];
		const q = after.players[i];
		return p && q ? { x: (q.x - p.x) / dt, y: (q.y - p.y) / dt } : null;
	});
}

const MOVING_SPEED = 1.2; // m/s — below this, direction of travel says little about facing

/**
 * SkillCorner's broadcast tracking has no body orientation, so heading is estimated:
 * the direction of travel when a player is moving, otherwise towards the ball
 * (players at rest are usually watching play). Returns radians in pitch coordinates.
 */
export function headings(frame: Frame, vel: (Vec | null)[]): (number | null)[] {
	return frame.players.map((p, i) => {
		if (!p) return null;
		const v = vel[i];
		if (v && Math.hypot(v.x, v.y) >= MOVING_SPEED) return Math.atan2(v.y, v.x);
		if (frame.ball) return Math.atan2(frame.ball.y - p.y, frame.ball.x - p.x);
		return v ? Math.atan2(v.y, v.x) : null;
	});
}

export function speed(v: Vec | null): number | null {
	return v ? Math.hypot(v.x, v.y) : null;
}

/* ---------- Pitch control ---------- */

const REACTION_TIME = 0.7; // s
const MAX_SPEED = 5; // m/s
const SIGMA = 0.45; // s — spread of arrival-time uncertainty
const LOGISTIC_K = Math.PI / Math.sqrt(3) / SIGMA;

export interface ControlGrid {
	cols: number;
	rows: number;
	/** Probability the home team controls each cell, row-major from y = -width/2. */
	home: Float32Array;
}

/**
 * A simplified time-to-intercept pitch control model (after Spearman, 2018): each player
 * keeps their current velocity during a reaction delay, then runs straight at top speed.
 * A cell's control is a logistic function of the gap between the fastest home and the
 * fastest away arrival times. It ignores ball flight time, which keeps it cheap enough
 * to recompute for every rendered frame.
 */
export function pitchControl(frame: Frame, vel: (Vec | null)[], players: MatchPlayer[], pitch: MatchMeta['pitch'], cellSize = 2): ControlGrid {
	const cols = Math.round(pitch.length / cellSize);
	const rows = Math.round(pitch.width / cellSize);
	const home = new Float32Array(cols * rows);

	const starts: { x: number; y: number; home: boolean }[] = [];
	frame.players.forEach((p, i) => {
		if (!p) return;
		const v = vel[i] ?? { x: 0, y: 0 };
		starts.push({ x: p.x + v.x * REACTION_TIME, y: p.y + v.y * REACTION_TIME, home: players[i].team === 'home' });
	});

	for (let r = 0; r < rows; r++) {
		const y = -pitch.width / 2 + (r + 0.5) * (pitch.width / rows);
		for (let c = 0; c < cols; c++) {
			const x = -pitch.length / 2 + (c + 0.5) * (pitch.length / cols);
			let bestHome = Infinity;
			let bestAway = Infinity;
			for (const s of starts) {
				const d = Math.hypot(x - s.x, y - s.y);
				if (s.home) bestHome = Math.min(bestHome, d);
				else bestAway = Math.min(bestAway, d);
			}
			const dt = (bestAway - bestHome) / MAX_SPEED;
			home[r * cols + c] = 1 / (1 + Math.exp(-LOGISTIC_K * dt));
		}
	}
	return { cols, rows, home };
}

/* ---------- Formation lines ---------- */

const LINES: Line[] = ['DEF', 'MID', 'ATT'];

/**
 * Outfield players on the pitch grouped by side and line, each line ordered across the
 * pitch so a polyline through it reads left-to-right.
 */
export function formationLines(frame: Frame, players: MatchPlayer[]): { team: Side; line: Line; points: Vec[] }[] {
	const out: { team: Side; line: Line; points: Vec[] }[] = [];
	for (const team of ['home', 'away'] as Side[]) {
		for (const line of LINES) {
			const points = players
				.filter((p) => p.team === team && p.line === line)
				.map((p) => frame.players[p.slot])
				.filter((p): p is NonNullable<typeof p> => p !== null)
				.sort((a, b) => a.y - b.y);
			if (points.length >= 2) out.push({ team, line, points });
		}
	}
	return out;
}

/* ---------- Clock & score ---------- */

export function periodAt(meta: MatchMeta, frame: number): number | null {
	const p = meta.periods.find((p) => frame >= p.startFrame && frame <= p.endFrame);
	return p ? p.period : null;
}

/** Match clock, counting the second half from 45:00 like a broadcast scoreboard. */
export function clockAt(meta: MatchMeta, frame: number): string {
	const period = meta.periods.find((p) => frame <= p.endFrame) ?? meta.periods[meta.periods.length - 1];
	const offset = (period.period - 1) * 45 * 60;
	const seconds = Math.max(0, offset + (frame - period.startFrame) / meta.fps);
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function scoreAt(goals: MatchGoal[], frame: number): { home: number; away: number } {
	let home = 0;
	let away = 0;
	for (const g of goals) {
		if (g.frame !== null && g.frame <= frame) {
			if (g.team === 'home') home++;
			else away++;
		}
	}
	return { home, away };
}

export const RUN_LABELS: Record<string, string> = {
	run_ahead_of_the_ball: 'Ahead of the ball',
	support: 'Support',
	dropping_off: 'Dropping off',
	coming_short: 'Coming short',
	pulling_wide: 'Pulling wide',
	cross_receiver: 'Cross receiver',
	behind: 'In behind',
	overlap: 'Overlap',
	underlap: 'Underlap',
	pulling_half_space: 'Pulling half-space'
};
