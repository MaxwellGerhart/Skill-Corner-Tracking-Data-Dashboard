import { error } from '@sveltejs/kit';
import { loadDataset } from '../../../lib/data/dataset.server';

export async function load({ params }: { params: { id: string } }) {
	const player = (await loadDataset()).players.find((p) => p.id === params.id);
	if (!player) error(404, 'Player not found');
	return { player };
}
