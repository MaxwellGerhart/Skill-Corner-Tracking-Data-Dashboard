import type { PositionGroup } from '../data/types';

/**
 * Position-group identity for charts. Five groups exceed what a single categorical
 * hue ramp can carry safely on an all-pairs chart (scatter), so colour here is a
 * supporting cue only — marker SHAPE is the primary identity channel (see
 * ScatterChart), and every chart also carries a legend and text label. The hues
 * live as CSS custom properties in layout.css (--color-pos-*); see the note there
 * on the chosen palette's trade-offs.
 */
export const POSITION_ORDER: PositionGroup[] = [
	'Center Forward',
	'Wide Attacker',
	'Midfield',
	'Full Back',
	'Central Defender'
];

export const POSITION_SHORT: Record<PositionGroup, string> = {
	'Center Forward': 'CF',
	'Wide Attacker': 'WA',
	Midfield: 'MF',
	'Full Back': 'FB',
	'Central Defender': 'CD'
};

export const POSITION_COLOR_VAR: Record<PositionGroup, string> = {
	'Center Forward': '--color-pos-cf',
	'Wide Attacker': '--color-pos-wa',
	Midfield: '--color-pos-mf',
	'Full Back': '--color-pos-fb',
	'Central Defender': '--color-pos-cd'
};

export const POSITION_BG_CLASS: Record<PositionGroup, string> = {
	'Center Forward': 'bg-pos-cf',
	'Wide Attacker': 'bg-pos-wa',
	Midfield: 'bg-pos-mf',
	'Full Back': 'bg-pos-fb',
	'Central Defender': 'bg-pos-cd'
};

export const POSITION_TEXT_CLASS: Record<PositionGroup, string> = {
	'Center Forward': 'text-pos-cf',
	'Wide Attacker': 'text-pos-wa',
	Midfield: 'text-pos-mf',
	'Full Back': 'text-pos-fb',
	'Central Defender': 'text-pos-cd'
};

export type MarkerShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';

export const POSITION_SHAPE: Record<PositionGroup, MarkerShape> = {
	'Center Forward': 'circle',
	'Wide Attacker': 'square',
	Midfield: 'triangle',
	'Full Back': 'diamond',
	'Central Defender': 'cross'
};

export function positionColorVar(position: PositionGroup): string {
	return `var(${POSITION_COLOR_VAR[position]})`;
}
