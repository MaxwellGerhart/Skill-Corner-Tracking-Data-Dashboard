/** Match data as the dashboard uses it, read from TiDB (see src/lib/match/data.server.ts). */

export type Side = 'home' | 'away';
export type Line = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface MatchTeam {
	id: number;
	name: string;
	shortName: string;
	acronym: string;
	score: number;
}

export interface MatchSummary {
	id: number;
	date: string;
	round: string;
	stadium: string;
	home: MatchTeam;
	away: MatchTeam;
}

export interface MatchPlayer {
	slot: number;
	id: number;
	name: string;
	shortName: string;
	number: number;
	team: Side;
	role: string;
	line: Line;
	startFrame: number | null;
	endFrame: number | null;
}

export interface MatchPeriod {
	period: number;
	startFrame: number;
	endFrame: number;
}

export interface MatchGoal {
	/** null when the events never pin the goal down (it still counts in the final score). */
	frame: number | null;
	team: Side;
	/** null when the credited scorer can't be matched to an event (own goals, deflections). */
	player: string | null;
	minute: number | null;
}

export interface MatchMeta extends MatchSummary {
	competition: string;
	pitch: { length: number; width: number };
	fps: number;
	chunkSize: number;
	nFrames: number;
	periods: MatchPeriod[];
	/** Attacking direction of the home team, one entry per period. */
	homeSide: ('left_to_right' | 'right_to_left')[];
	players: MatchPlayer[];
	goals: MatchGoal[];
}

export interface MatchShot {
	frame: number;
	team: Side;
	player: string;
	slot: number | null;
	minute: number;
	goal: boolean;
}

export interface MatchRun {
	id: string;
	frameStart: number;
	frameEnd: number;
	team: Side;
	player: string;
	slot: number | null;
	subtype: string;
	start: [number, number];
	end: [number, number];
	minute: number;
	targeted: boolean;
	received: boolean;
	dangerous: boolean;
	leadToShot: boolean;
	leadToGoal: boolean;
}

export interface MatchEvents {
	shots: MatchShot[];
	runs: MatchRun[];
}

/** One decoded tracking frame. Positions are metres, pitch centre at (0, 0). */
export interface Frame {
	ball: { x: number; y: number; z: number; detected: boolean } | null;
	/** Broadcast camera footprint: top-left, bottom-left, bottom-right, top-right. */
	camera: [number, number][] | null;
	possession: Side | null;
	/** Indexed by player slot; null when the player is not on the pitch. */
	players: ({ x: number; y: number; detected: boolean } | null)[];
}
