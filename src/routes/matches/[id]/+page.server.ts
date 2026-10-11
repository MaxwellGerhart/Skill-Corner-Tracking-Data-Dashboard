import { error } from '@sveltejs/kit';
import { loadMatch } from '../../../lib/match/data.server';

export async function load({ params }: { params: { id: string } }) {
	const id = Number(params.id);
	const match = Number.isInteger(id) ? await loadMatch(id) : null;
	if (!match) error(404, 'Match not found');
	return match;
}
