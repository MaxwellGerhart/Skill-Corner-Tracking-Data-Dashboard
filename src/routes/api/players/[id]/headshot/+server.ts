import { error } from '@sveltejs/kit';
import { query } from '../../../../../lib/server/db';
import type { RequestHandler } from './$types';

/** A player headshot from TiDB (loaded by scripts/fetch_headshots.py), as a small WebP. */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const playerId = Number(params.id);
	if (!Number.isInteger(playerId)) error(400, 'Bad player id');
	const [row] = await query<{ mime: string; image: Buffer }>('SELECT mime, image FROM player_headshots WHERE player_id = ?', [playerId]);
	if (!row) error(404, 'No headshot for this player');
	setHeaders({ 'cache-control': 'public, max-age=604800' });
	return new Response(new Uint8Array(row.image), { headers: { 'content-type': row.mime } });
};
