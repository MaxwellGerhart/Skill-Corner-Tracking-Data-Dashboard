import { error } from '@sveltejs/kit';
import { query } from '../../../../../lib/server/db';
import type { RequestHandler } from './$types';

/** A club crest from TiDB (loaded by scripts/fetch_logos.py), as a small WebP. */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const teamId = Number(params.id);
	if (!Number.isInteger(teamId)) error(400, 'Bad team id');
	const [row] = await query<{ mime: string; image: Buffer }>('SELECT mime, image FROM team_logos WHERE team_id = ?', [teamId]);
	if (!row) error(404, 'No crest for this team');
	setHeaders({ 'cache-control': 'public, max-age=604800' });
	return new Response(new Uint8Array(row.image), { headers: { 'content-type': row.mime } });
};
