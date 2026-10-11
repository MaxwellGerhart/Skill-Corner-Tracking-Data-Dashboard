import { error } from '@sveltejs/kit';
import { query } from '../../../../../../lib/server/db';
import { CHUNK_SIZE, loadSlots } from '../../../../../../lib/match/data.server';
import { FRAME_HEADER, FRAME_NA } from '../../../../../../lib/match/frames';
import type { RequestHandler } from './$types';

const slotsCache = new Map<number, Promise<number[]>>();

const toCm = (v: number | null) => (v === null ? FRAME_NA : Math.max(-32767, Math.min(32767, Math.round(v * 100))));

/**
 * One minute (600 frames) of tracking for the match viewer, read from TiDB and packed
 * into the little-endian int16 layout FrameStore decodes (see src/lib/match/frames.ts).
 * ~13k position rows per request become a ~95 KB binary instead of ~1 MB of JSON.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const matchId = Number(params.id);
	const chunk = Number(params.chunk);
	if (!Number.isInteger(matchId) || !Number.isInteger(chunk) || chunk < 0) error(400, 'Bad match or chunk');

	const [match] = await query<{ n_frames: number }>('SELECT n_frames FROM matches WHERE match_id = ?', [matchId]);
	if (!match) error(404, 'Match not found');
	const first = chunk * CHUNK_SIZE;
	if (first >= match.n_frames) error(404, 'Chunk out of range');
	const last = Math.min(match.n_frames - 1, first + CHUNK_SIZE - 1);

	let slots = slotsCache.get(matchId);
	if (!slots) {
		slots = loadSlots(matchId);
		slotsCache.set(matchId, slots);
		slots.catch(() => slotsCache.delete(matchId));
	}
	const slotById = new Map((await slots).map((id, slot) => [id, slot]));
	const nSlots = slotById.size;
	const nWords = Math.ceil((nSlots + 1) / 16);
	const stride = FRAME_HEADER + 2 * nSlots + nWords;

	const [frames, positions] = await Promise.all([
		query<Record<string, number | string | null>>(
			`SELECT frame, ball_x, ball_y, ball_z, ball_detected, possession,
			        cam_tl_x, cam_tl_y, cam_bl_x, cam_bl_y, cam_br_x, cam_br_y, cam_tr_x, cam_tr_y
			   FROM tracking_frames WHERE match_id = ? AND frame BETWEEN ? AND ?`,
			[matchId, first, last]
		),
		query<{ frame: number; player_id: number; x: number; y: number; is_detected: number }>(
			'SELECT frame, player_id, x, y, is_detected FROM tracking_positions WHERE match_id = ? AND frame BETWEEN ? AND ?',
			[matchId, first, last]
		)
	]);

	const data = new Int16Array((last - first + 1) * stride);
	// Frames outside play (before kick-off, half-time) have no row and stay all-NA.
	for (let f = 0; f <= last - first; f++) {
		data.fill(FRAME_NA, f * stride, f * stride + FRAME_HEADER + 2 * nSlots);
		data[f * stride + 11] = 0; // possession: none
	}

	const corners = ['cam_tl_x', 'cam_tl_y', 'cam_bl_x', 'cam_bl_y', 'cam_br_x', 'cam_br_y', 'cam_tr_x', 'cam_tr_y'];
	for (const row of frames) {
		const o = ((row.frame as number) - first) * stride;
		data[o] = toCm(row.ball_x as number | null);
		data[o + 1] = toCm(row.ball_y as number | null);
		data[o + 2] = toCm(row.ball_z as number | null);
		corners.forEach((key, i) => (data[o + 3 + i] = toCm(row[key] as number | null)));
		data[o + 11] = row.possession === 'home' ? 1 : row.possession === 'away' ? 2 : 0;
		if (row.ball_detected) data[o + FRAME_HEADER + 2 * nSlots] |= 1;
	}

	for (const p of positions) {
		const slot = slotById.get(Number(p.player_id));
		if (slot === undefined) continue;
		const o = (p.frame - first) * stride;
		data[o + FRAME_HEADER + 2 * slot] = toCm(p.x);
		data[o + FRAME_HEADER + 2 * slot + 1] = toCm(p.y);
		if (p.is_detected) {
			const bit = slot + 1;
			data[o + FRAME_HEADER + 2 * nSlots + (bit >> 4)] |= 1 << (bit & 15);
		}
	}

	// Tracking for a finished match never changes; let the browser keep chunks for a day.
	setHeaders({ 'cache-control': 'public, max-age=86400' });
	// Int16Array uses platform byte order; every server platform we target is little-endian.
	return new Response(data.buffer, { headers: { 'content-type': 'application/octet-stream' } });
};
