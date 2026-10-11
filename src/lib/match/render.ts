import { Delaunay } from 'd3-delaunay';
import type { Frame, MatchMeta, MatchRun, Side } from './types';
import { formationLines, RUN_LABELS, type ControlGrid, type Vec } from './models';

export interface Layers {
	numbers: boolean;
	trails: boolean;
	voronoi: boolean;
	pitchControl: boolean;
	formation: boolean;
	orientation: boolean;
	visionCones: boolean;
	camera: boolean;
	ghosting: boolean;
	runs: boolean;
	follow: boolean;
	vertical: boolean;
}

export interface Palette {
	home: string;
	away: string;
	pitch: string;
	line: string;
	fg: string;
	fgSoft: string;
	fgFaint: string;
	homeRgb: [number, number, number];
	awayRgb: [number, number, number];
	pitchRgb: [number, number, number];
}

/** World-space window shown on screen: centre in metres and zoom (1 = whole pitch). */
export interface View {
	cx: number;
	cy: number;
	zoom: number;
}

export const PITCH_MARGIN = 3; // metres of run-off drawn around the pitch

/** Canvas aspect ratio (height / width) for the chosen orientation. */
export function aspectRatio(pitch: MatchMeta['pitch'], vertical: boolean): number {
	const w = pitch.length + 2 * PITCH_MARGIN;
	const h = pitch.width + 2 * PITCH_MARGIN;
	return vertical ? w / h : h / w;
}

export class Projection {
	readonly k: number;
	constructor(
		readonly width: number,
		readonly height: number,
		readonly pitch: MatchMeta['pitch'],
		readonly view: View,
		readonly vertical: boolean
	) {
		const along = pitch.length + 2 * PITCH_MARGIN;
		this.k = ((vertical ? height : width) / along) * view.zoom;
	}

	/** World metres → canvas pixels. */
	toScreen(x: number, y: number): [number, number] {
		const { cx, cy } = this.view;
		if (this.vertical) return [this.width / 2 - (y - cy) * this.k, this.height / 2 - (x - cx) * this.k];
		return [this.width / 2 + (x - cx) * this.k, this.height / 2 - (y - cy) * this.k];
	}

	/** Canvas pixels → world metres. */
	toWorld(sx: number, sy: number): [number, number] {
		const { cx, cy } = this.view;
		if (this.vertical) return [cx - (sy - this.height / 2) / this.k, cy - (sx - this.width / 2) / this.k];
		return [cx + (sx - this.width / 2) / this.k, cy - (sy - this.height / 2) / this.k];
	}

	/** Make the context draw in world metres (for shapes; text stays in screen space). */
	applyWorld(ctx: CanvasRenderingContext2D, dpr: number) {
		const { cx, cy } = this.view;
		const k = this.k * dpr;
		if (this.vertical) ctx.setTransform(0, -k, -k, 0, (this.width / 2 + cy * this.k) * dpr, (this.height / 2 + cx * this.k) * dpr);
		else ctx.setTransform(k, 0, 0, -k, (this.width / 2 - cx * this.k) * dpr, (this.height / 2 + cy * this.k) * dpr);
	}
}

export function readPalette(el: Element): Palette {
	const css = getComputedStyle(el);
	const probe = document.createElement('canvas').getContext('2d')!;
	const resolve = (name: string, fallback: string) => {
		probe.fillStyle = fallback;
		probe.fillStyle = css.getPropertyValue(name).trim() || fallback;
		return probe.fillStyle as string;
	};
	const rgb = (hex: string): [number, number, number] => {
		const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
		return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
	};
	const home = resolve('--color-team-home', '#2a78d6');
	const away = resolve('--color-team-away', '#eb6834');
	const pitch = resolve('--color-pitch', '#ffffff');
	return {
		home,
		away,
		pitch,
		line: resolve('--color-pitch-line', '#b9bbb7'),
		fg: resolve('--color-fg', '#161716'),
		fgSoft: resolve('--color-fg-soft', '#3a3b3a'),
		fgFaint: resolve('--color-fg-faint', '#5e605d'),
		homeRgb: rgb(home),
		awayRgb: rgb(away),
		pitchRgb: rgb(pitch)
	};
}

function teamColor(palette: Palette, side: Side) {
	return side === 'home' ? palette.home : palette.away;
}

function withAlpha(rgb: [number, number, number], a: number) {
	return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

export interface Scene {
	meta: MatchMeta;
	frame: Frame;
	/** Recent positions per slot, oldest first, for trails. */
	trails: (Vec | null)[][] | null;
	headings: (number | null)[] | null;
	control: ControlGrid | null;
	activeRuns: MatchRun[];
	highlightSlot: number | null;
}

export function drawScene(ctx: CanvasRenderingContext2D, proj: Projection, dpr: number, scene: Scene, layers: Layers, palette: Palette) {
	const { meta, frame } = scene;
	const L = meta.pitch.length;
	const W = meta.pitch.width;

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, proj.width, proj.height);
	ctx.fillStyle = palette.pitch;
	ctx.fillRect(0, 0, proj.width, proj.height);

	proj.applyWorld(ctx, dpr);
	const px = 1 / proj.k; // one screen pixel in metres

	// Pitch control sits under everything, clipped to the field of play.
	if (layers.pitchControl && scene.control) drawControl(ctx, scene.control, L, W, palette);

	if (layers.voronoi) drawVoronoi(ctx, scene, L, W, palette, px);

	drawPitchMarkings(ctx, L, W, palette, px);

	if (layers.camera && frame.camera) {
		ctx.beginPath();
		frame.camera.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.fillStyle = withAlpha(hexRgb(palette.fgFaint), 0.08);
		ctx.fill();
		ctx.setLineDash([6 * px, 4 * px]);
		ctx.lineWidth = 1.5 * px;
		ctx.strokeStyle = palette.fgFaint;
		ctx.stroke();
		ctx.setLineDash([]);
	}

	if (layers.formation) {
		for (const line of formationLines(frame, meta.players)) {
			ctx.beginPath();
			line.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
			ctx.strokeStyle = teamColor(palette, line.team);
			ctx.globalAlpha = 0.75;
			ctx.lineWidth = 2 * px;
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}

	if (layers.trails && scene.trails) {
		ctx.lineCap = 'round';
		scene.trails.forEach((trail, slot) => {
			const side = meta.players[slot].team;
			const rgb = side === 'home' ? palette.homeRgb : palette.awayRgb;
			for (let i = 1; i < trail.length; i++) {
				const a = trail[i - 1];
				const b = trail[i];
				if (!a || !b) continue;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
				ctx.strokeStyle = withAlpha(rgb, (i / trail.length) * 0.6);
				ctx.lineWidth = 2 * px;
				ctx.stroke();
			}
		});
		ctx.lineCap = 'butt';
	}

	if (layers.visionCones && scene.headings) {
		const reach = 12;
		const half = Math.PI / 6;
		frame.players.forEach((p, slot) => {
			const h = scene.headings![slot];
			if (!p || h === null) return;
			const rgb = meta.players[slot].team === 'home' ? palette.homeRgb : palette.awayRgb;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.arc(p.x, p.y, reach, h - half, h + half);
			ctx.closePath();
			const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, reach);
			g.addColorStop(0, withAlpha(rgb, 0.22));
			g.addColorStop(1, withAlpha(rgb, 0));
			ctx.fillStyle = g;
			ctx.fill();
		});
	}

	if (layers.runs) {
		for (const run of scene.activeRuns) drawRunArrow(ctx, run, palette, px);
	}

	// Screen-space marks: players, numbers, ball, labels.
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const radius = Math.max(5, Math.min(11, 0.9 * proj.k));

	frame.players.forEach((p, slot) => {
		if (!p) return;
		const player = meta.players[slot];
		const [sx, sy] = proj.toScreen(p.x, p.y);
		const color = teamColor(palette, player.team);
		const offCamera = layers.ghosting && !p.detected;

		if (layers.orientation && scene.headings) {
			const h = scene.headings[slot];
			if (h !== null) {
				const [tx, ty] = proj.toScreen(p.x + Math.cos(h) * 2.2, p.y + Math.sin(h) * 2.2);
				const ang = Math.atan2(ty - sy, tx - sx);
				ctx.beginPath();
				ctx.moveTo(sx + Math.cos(ang) * (radius + 8), sy + Math.sin(ang) * (radius + 8));
				ctx.lineTo(sx + Math.cos(ang + 0.7) * (radius + 1), sy + Math.sin(ang + 0.7) * (radius + 1));
				ctx.lineTo(sx + Math.cos(ang - 0.7) * (radius + 1), sy + Math.sin(ang - 0.7) * (radius + 1));
				ctx.closePath();
				ctx.fillStyle = color;
				ctx.globalAlpha = offCamera ? 0.45 : 1;
				ctx.fill();
				ctx.globalAlpha = 1;
			}
		}

		ctx.beginPath();
		ctx.arc(sx, sy, radius, 0, Math.PI * 2);
		if (offCamera) {
			ctx.fillStyle = palette.pitch;
			ctx.fill();
			ctx.setLineDash([3, 2]);
			ctx.lineWidth = 2;
			ctx.strokeStyle = color;
			ctx.stroke();
			ctx.setLineDash([]);
		} else {
			ctx.fillStyle = color;
			ctx.fill();
			// 2px surface ring separates overlapping players.
			ctx.lineWidth = 2;
			ctx.strokeStyle = palette.pitch;
			ctx.stroke();
		}

		if (scene.highlightSlot === slot) {
			ctx.beginPath();
			ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
			ctx.lineWidth = 2;
			ctx.strokeStyle = palette.fg;
			ctx.stroke();
		}

		if (layers.numbers && radius >= 7) {
			ctx.fillStyle = offCamera ? palette.fgSoft : player.team === 'home' ? '#ffffff' : '#161716';
			ctx.font = `600 ${Math.round(radius * 1.05)}px 'JetBrains Mono', monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(player.number), sx, sy + 0.5);
		}
	});

	if (frame.ball) {
		const [bx, by] = proj.toScreen(frame.ball.x, frame.ball.y);
		const r = Math.max(3.5, radius * 0.5) + Math.min(frame.ball.z, 6) * 0.6;
		ctx.beginPath();
		ctx.arc(bx, by, r, 0, Math.PI * 2);
		ctx.fillStyle = palette.fg;
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = palette.pitch;
		ctx.stroke();
	}

	if (layers.runs) {
		ctx.font = `500 11px 'Saira', Helvetica, sans-serif`;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		for (const run of scene.activeRuns) {
			const [ex, ey] = proj.toScreen(run.end[0], run.end[1]);
			const label = `${run.player} · ${runLabel(run.subtype)}`;
			const w = ctx.measureText(label).width;
			const lx = Math.min(Math.max(4, ex + 8), proj.width - w - 8);
			const ly = Math.max(16, ey - 8);
			ctx.fillStyle = withAlpha(palette.pitchRgb, 0.85);
			ctx.fillRect(lx - 3, ly - 14, w + 6, 16);
			ctx.fillStyle = palette.fg;
			ctx.fillText(label, lx, ly);
		}
	}
}

function hexRgb(hex: string): [number, number, number] {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
}

function runLabel(subtype: string) {
	return RUN_LABELS[subtype] ?? subtype.replace(/_/g, ' ');
}

function drawPitchMarkings(ctx: CanvasRenderingContext2D, L: number, W: number, palette: Palette, px: number) {
	ctx.strokeStyle = palette.line;
	ctx.lineWidth = 1.5 * px;
	const hl = L / 2;
	const hw = W / 2;
	ctx.strokeRect(-hl, -hw, L, W);
	ctx.beginPath();
	ctx.moveTo(0, -hw);
	ctx.lineTo(0, hw);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(0, 0, 9.15, 0, Math.PI * 2);
	ctx.stroke();
	for (const dir of [-1, 1]) {
		const goalX = dir * hl;
		// Penalty area, six-yard box, goal.
		ctx.strokeRect(Math.min(goalX, goalX - dir * 16.5), -20.16, 16.5, 40.32);
		ctx.strokeRect(Math.min(goalX, goalX - dir * 5.5), -9.16, 5.5, 18.32);
		ctx.strokeRect(Math.min(goalX, goalX + dir * 2), -3.66, 2, 7.32);
		// Penalty spot and arc.
		const spot = goalX - dir * 11;
		ctx.beginPath();
		ctx.arc(spot, 0, 0.3, 0, Math.PI * 2);
		ctx.fillStyle = palette.line;
		ctx.fill();
		const a = Math.acos((16.5 - 11) / 9.15);
		ctx.beginPath();
		if (dir === 1) ctx.arc(spot, 0, 9.15, Math.PI - a, Math.PI + a);
		else ctx.arc(spot, 0, 9.15, -a, a);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
	ctx.fillStyle = palette.line;
	ctx.fill();
}

let controlCanvas: HTMLCanvasElement | null = null;

function drawControl(ctx: CanvasRenderingContext2D, grid: ControlGrid, L: number, W: number, palette: Palette) {
	controlCanvas ??= document.createElement('canvas');
	if (controlCanvas.width !== grid.cols || controlCanvas.height !== grid.rows) {
		controlCanvas.width = grid.cols;
		controlCanvas.height = grid.rows;
	}
	const off = controlCanvas.getContext('2d')!;
	const img = off.createImageData(grid.cols, grid.rows);
	const [hr, hg, hb] = palette.homeRgb;
	const [ar, ag, ab] = palette.awayRgb;
	const [nr, ng, nb] = palette.pitchRgb;
	for (let i = 0; i < grid.home.length; i++) {
		// Diverging: away pole → neutral pitch surface at 0.5 → home pole.
		const p = grid.home[i];
		const t = Math.abs(p - 0.5) * 2;
		const [r, g, b] = p >= 0.5 ? [hr, hg, hb] : [ar, ag, ab];
		img.data[i * 4] = nr + (r - nr) * t;
		img.data[i * 4 + 1] = ng + (g - ng) * t;
		img.data[i * 4 + 2] = nb + (b - nb) * t;
		img.data[i * 4 + 3] = 255 * (0.1 + 0.4 * t);
	}
	off.putImageData(img, 0, 0);
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(controlCanvas, -L / 2, -W / 2, L, W);
}

function drawVoronoi(ctx: CanvasRenderingContext2D, scene: Scene, L: number, W: number, palette: Palette, px: number) {
	const pts: [number, number][] = [];
	const sides: Side[] = [];
	scene.frame.players.forEach((p, slot) => {
		if (!p) return;
		pts.push([p.x, p.y]);
		sides.push(scene.meta.players[slot].team);
	});
	if (pts.length < 3) return;
	const voronoi = Delaunay.from(pts).voronoi([-L / 2, -W / 2, L / 2, W / 2]);
	for (let i = 0; i < pts.length; i++) {
		const rgb = sides[i] === 'home' ? palette.homeRgb : palette.awayRgb;
		ctx.beginPath();
		voronoi.renderCell(i, ctx);
		ctx.fillStyle = withAlpha(rgb, 0.2);
		ctx.fill();
		ctx.lineWidth = 1 * px;
		ctx.strokeStyle = withAlpha(rgb, 0.55);
		ctx.stroke();
	}
}

function drawRunArrow(ctx: CanvasRenderingContext2D, run: MatchRun, palette: Palette, px: number) {
	const [x0, y0] = run.start;
	const [x1, y1] = run.end;
	const color = teamColor(palette, run.team);
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2.5 * px;
	ctx.setLineDash([7 * px, 4 * px]);
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
	ctx.setLineDash([]);
	const ang = Math.atan2(y1 - y0, x1 - x0);
	const head = 1.8;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45));
	ctx.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45));
	ctx.closePath();
	ctx.fill();
}
