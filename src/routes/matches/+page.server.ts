import { loadMatchIndex } from '../../lib/match/data.server';

export async function load() {
	return { matches: await loadMatchIndex() };
}
