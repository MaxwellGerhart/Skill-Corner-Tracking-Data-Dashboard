import type { RunTypeDefinition, RunTypeKey } from './types';

/** Ordered: the combined total first, then the 10 specific types as they appear in SkillCorner's raw file. */
export const RUN_TYPE_DEFINITIONS: RunTypeDefinition[] = [
	{
		key: 'offballrun',
		label: 'All runs',
		definition: 'Every off-ball run combined, across all 10 types below.'
	},
	{
		key: 'behindrun',
		label: 'In behind',
		definition: 'A sprint beyond the last line of defenders, into the space behind the back line.'
	},
	{
		key: 'comingshortrun',
		label: 'Coming short',
		definition: 'Moving towards the ball carrier to offer a short, easy passing option.'
	},
	{
		key: 'crossreceiverrun',
		label: 'Cross receiver',
		definition: 'Moving into the box or a wide channel to arrive for a cross.'
	},
	{
		key: 'droppingoffrun',
		label: 'Dropping off',
		definition: 'Peeling away from the last line, back towards the ball, to open a passing lane.'
	},
	{
		key: 'overlaprun',
		label: 'Overlap',
		definition: "Running around the outside of a teammate on the ball, usually out wide."
	},
	{
		key: 'pullinghalfspacerun',
		label: 'Pulling to half-space',
		definition: 'Moving into the half-space, the vertical channel between the wing and the centre.'
	},
	{
		key: 'pullingwiderun',
		label: 'Pulling wide',
		definition: 'Moving towards the touchline to stretch the defence and open the middle.'
	},
	{
		key: 'aheadoftheballrun',
		label: 'Ahead of the ball',
		definition: 'A forward run beyond the ball carrier, often breaking in transition.'
	},
	{
		key: 'supportrun',
		label: 'Support',
		definition: 'Moving to offer a nearby passing option without a specific pattern.'
	},
	{
		key: 'underlaprun',
		label: 'Underlap',
		definition: 'Running inside a wide teammate, cutting infield rather than around the outside.'
	}
];

export const RUN_TYPE_BY_KEY: Record<RunTypeKey, RunTypeDefinition> = Object.fromEntries(
	RUN_TYPE_DEFINITIONS.map((d) => [d.key, d])
) as Record<RunTypeKey, RunTypeDefinition>;

/** The 10 specific types, excluding the `offballrun` combined total — used for "run-type mix" breakdowns. */
export const SPECIFIC_RUN_TYPE_DEFINITIONS = RUN_TYPE_DEFINITIONS.filter((d) => d.key !== 'offballrun');
