import { loadDataset } from '../lib/data/dataset.server';
import { loadMatchIndex } from '../lib/match/data.server';

export async function load() {
	// The match index (20 rows) rides along so the command palette can search matches
	// from any page.
	const [dataset, matches] = await Promise.all([loadDataset(), loadMatchIndex()]);
	return { dataset, matches };
}
