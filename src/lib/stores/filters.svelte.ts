import { getContext, setContext } from 'svelte';
import type { PlayerRecord } from '../data/types';

const KEY = Symbol('fieldline-filters');

export const ALL = 'All' as const;

export class FilterState {
	position = $state<string>(ALL);
	team = $state<string>(ALL);
	minMatches = $state<number>(5);

	reset(floor: number) {
		this.position = ALL;
		this.team = ALL;
		this.minMatches = floor;
	}
}

export function setFilterState(minMatchesFloor: number): FilterState {
	const state = new FilterState();
	state.minMatches = minMatchesFloor;
	setContext(KEY, state);
	return state;
}

export function getFilterState(): FilterState {
	const state = getContext<FilterState>(KEY);
	if (!state) throw new Error('FilterState not set — call setFilterState() in a root layout first.');
	return state;
}

export function applyFilters(players: PlayerRecord[], filters: FilterState): PlayerRecord[] {
	return players.filter((p) => {
		if (filters.position !== ALL && p.position !== filters.position) return false;
		if (filters.team !== ALL && p.team !== filters.team) return false;
		if (p.matches < filters.minMatches) return false;
		return true;
	});
}
