export type PositionGroup =
	| 'Center Forward'
	| 'Wide Attacker'
	| 'Midfield'
	| 'Full Back'
	| 'Central Defender';

export const POSITION_GROUPS: PositionGroup[] = [
	'Center Forward',
	'Wide Attacker',
	'Midfield',
	'Full Back',
	'Central Defender'
];

/** The 10 specific off-ball run types SkillCorner detects. */
export type SpecificRunTypeKey =
	| 'behindrun'
	| 'comingshortrun'
	| 'crossreceiverrun'
	| 'droppingoffrun'
	| 'overlaprun'
	| 'pullinghalfspacerun'
	| 'pullingwiderun'
	| 'aheadoftheballrun'
	| 'supportrun'
	| 'underlaprun';

/** The 10 specific types, plus `offballrun`, the combined "all runs" aggregate. */
export type RunTypeKey = SpecificRunTypeKey | 'offballrun';

export interface RunTypeMetrics {
	/** Runs of this type, per 30 minutes of team possession. */
	countPer30: number;
	/** Of those, how many were passed to the runner. */
	targetedPer30: number;
	/** Of those, how many the runner actually received. */
	receivedPer30: number;
	/** Of those, how many SkillCorner rated as dangerous. */
	dangerousPer30: number;
	/** Of those, how many were followed by a shot within 10 seconds. */
	shotWithin10sPer30: number;
	/** Of those, how many were followed by a goal within 10 seconds. */
	goalWithin10sPer30: number;
	/** Of those, how many were run above the high-speed-running threshold. */
	aboveHsrPer30: number;
	/** Average distance covered per run of this type, in metres. Null if the player never made this run type. */
	avgDistanceM: number | null;
}

export interface PlayerRecord {
	/** Stable, URL-safe id: `${playerId}-${positionSlug}`. */
	id: string;
	playerId: string;
	teamId: string;
	/** Whether player_headshots has a photo (otherwise the UI shows initials). */
	hasHeadshot: boolean;
	player: string;
	team: string;
	position: PositionGroup;
	matches: number;
	minutes: number;
	minutesTip: number;
	totalRuns: number;
	runsPer30: number;
	dangerousRunsPer30: number;
	pctDangerous: number;
	pctPassedTo: number;
	pctReceived: number;
	runsInBehindPer30: number;
	highSpeedRunsPer30: number;
	avgRunLengthM: number;
	runTypes: Record<RunTypeKey, RunTypeMetrics>;
}

export interface RunTypeDefinition {
	key: RunTypeKey;
	label: string;
	definition: string;
}

export interface DatasetMeta {
	season: string;
	competition: string;
	minMatchesFloor: number;
	maxMatches: number;
	playerCount: number;
	teamCount: number;
}

export interface Dataset {
	players: PlayerRecord[];
	positions: PositionGroup[];
	teams: string[];
	meta: DatasetMeta;
}
