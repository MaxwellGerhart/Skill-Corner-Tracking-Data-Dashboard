import type { Frame, MatchMeta } from './types';

/** Missing-value sentinel and per-frame header length of the int16 frame layout. */
export const FRAME_NA = -32768;
export const FRAME_HEADER = 12;
const MAX_CHUNKS = 24;

/**
 * Loads a match's tracking data one-minute chunk at a time from the frames API and
 * decodes individual frames on demand. Per frame, all int16 in centimetres (missing = FRAME_NA):
 * ball x/y/z, the camera footprint's four corners (x,y each), possession (0 none,
 * 1 home, 2 away), x/y for every player slot, then a detection bitmask (bit 0 = ball,
 * bit slot+1 = player). Chunks are fetched lazily and kept in a small least-recently-used
 * cache, so scrubbing anywhere in a 97 MB match only ever downloads ~100 KB at a time.
 */
export class FrameStore {
	private chunks = new Map<number, Int16Array>();
	private pending = new Map<number, Promise<void>>();
	private readonly stride: number;
	private readonly nSlots: number;
	private readonly nWords: number;
	/** Called whenever a chunk finishes loading, so a paused view can redraw. */
	onload: (() => void) | null = null;

	constructor(
		private readonly meta: MatchMeta,
		private readonly baseUrl: string
	) {
		this.nSlots = meta.players.length;
		this.nWords = Math.ceil((this.nSlots + 1) / 16);
		this.stride = FRAME_HEADER + 2 * this.nSlots + this.nWords;
	}

	chunkOf(frame: number): number {
		return Math.floor(frame / this.meta.chunkSize);
	}

	has(frame: number): boolean {
		return this.chunks.has(this.chunkOf(frame));
	}

	/** Start loading the chunks covering [from, to]; resolves when all are present. */
	ensure(from: number, to: number = from): Promise<void> {
		const first = this.chunkOf(Math.max(0, from));
		const last = this.chunkOf(Math.min(this.meta.nFrames - 1, to));
		const jobs: Promise<void>[] = [];
		for (let c = first; c <= last; c++) jobs.push(this.load(c));
		return Promise.all(jobs).then(() => undefined);
	}

	private load(chunk: number): Promise<void> {
		const cached = this.chunks.get(chunk);
		if (cached) {
			// Refresh LRU position.
			this.chunks.delete(chunk);
			this.chunks.set(chunk, cached);
			return Promise.resolve();
		}
		const inflight = this.pending.get(chunk);
		if (inflight) return inflight;
		const job = fetch(`${this.baseUrl}/frames/${chunk}`)
			.then((res) => {
				if (!res.ok) throw new Error(`Frame chunk ${chunk}: HTTP ${res.status}`);
				return res.arrayBuffer();
			})
			.then((buffer) => {
				this.chunks.set(chunk, new Int16Array(buffer));
				while (this.chunks.size > MAX_CHUNKS) {
					const oldest = this.chunks.keys().next().value as number;
					this.chunks.delete(oldest);
				}
				this.onload?.();
			})
			.finally(() => this.pending.delete(chunk));
		this.pending.set(chunk, job);
		return job;
	}

	/** Decode one frame, or null if its chunk hasn't loaded yet. */
	get(frame: number): Frame | null {
		if (frame < 0 || frame >= this.meta.nFrames) return null;
		const data = this.chunks.get(this.chunkOf(frame));
		if (!data) return null;
		const o = (frame % this.meta.chunkSize) * this.stride;
		if (o + this.stride > data.length) return null;

		const bitsAt = (bit: number) => ((data[o + FRAME_HEADER + 2 * this.nSlots + (bit >> 4)] & 0xffff) >> (bit & 15)) & 1;

		const ball =
			data[o] === FRAME_NA ? null : { x: data[o] / 100, y: data[o + 1] / 100, z: Math.max(0, data[o + 2]) / 100, detected: bitsAt(0) === 1 };

		let camera: [number, number][] | null = null;
		if (data[o + 3] !== FRAME_NA) {
			camera = [];
			for (let i = 0; i < 4; i++) camera.push([data[o + 3 + 2 * i] / 100, data[o + 4 + 2 * i] / 100]);
		}

		const pos = data[o + 11];
		const players: Frame['players'] = new Array(this.nSlots);
		for (let s = 0; s < this.nSlots; s++) {
			const x = data[o + FRAME_HEADER + 2 * s];
			players[s] = x === FRAME_NA ? null : { x: x / 100, y: data[o + FRAME_HEADER + 2 * s + 1] / 100, detected: bitsAt(s + 1) === 1 };
		}

		return { ball, camera, possession: pos === 1 ? 'home' : pos === 2 ? 'away' : null, players };
	}
}
