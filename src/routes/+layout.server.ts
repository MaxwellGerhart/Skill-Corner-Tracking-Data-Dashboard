import { loadDataset } from '../lib/data/dataset.server';

export async function load() {
	return { dataset: await loadDataset() };
}
