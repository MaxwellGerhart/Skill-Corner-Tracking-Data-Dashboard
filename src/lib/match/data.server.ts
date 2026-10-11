import { query } from '../server/db';
import type { Line, MatchEvents, MatchMeta, MatchPlayer, MatchRun, MatchShot, MatchSummary, Side } from './types';

/** Frames per tracking chunk served by /api/matches/[id]/frames/[chunk]. */
export const CHUNK_SIZE = 600;

interface MatchRow {
	match_id: number;
	date_time: string;
	competition: string;
	round_name: string;
	stadium: string;
	home_team_id: number;
	home_name: string;
	home_short_name: string;
	home_acronym: string;
	home_score: number;
	away_team_id: number;
	away_name: string;
	away_short_name: string;
	away_acronym: string;
	away_score: number;
	pitch_length: number;
	pitch_width: number;
	fps: number;
	n_frames: number;
	periods: MatchMeta['periods'];
	home_side: MatchMeta['homeSide'];
}

function summary(row: MatchRow): MatchSummary {
	return {
		id: Number(row.match_id),
		// Stored as UTC without a zone; make it an ISO string every browser parses the same way.
		date: `${row.date_time.replace(' ', 'T')}Z`,
		round: row.round_name,
		stadium: row.stadium,
		home: { id: Number(row.home_team_id), name: row.home_name, shortName: row.home_short_name, acronym: row.home_acronym, score: row.home_score },
		away: { id: Number(row.away_team_id), name: row.away_name, shortName: row.away_short_name, acronym: row.away_acronym, score: row.away_score }
	};
}

export async function loadMatchIndex(): Promise<MatchSummary[]> {
	const rows = await query<MatchRow>('SELECT * FROM matches ORDER BY date_time');
	return rows.map(summary);
}

/** Tracked players in frame-layout order (slot), as the frames API encodes them. */
export async function loadSlots(matchId: number): Promise<number[]> {
	const rows = await query<{ player_id: number }>(
		'SELECT player_id FROM match_players WHERE match_id = ? AND slot IS NOT NULL ORDER BY slot',
		[matchId]
	);
	return rows.map((r) => Number(r.player_id));
}

export async function loadMatch(id: number): Promise<{ meta: MatchMeta; events: MatchEvents } | null> {
	const [match] = await query<MatchRow>('SELECT * FROM matches WHERE match_id = ?', [id]);
	if (!match) return null;

	const [playerRows, goalRows, shotRows, runRows] = await Promise.all([
		query<{ player_id: number; slot: number; team: Side; name: string; short_name: string; number: number; role: string; line: Line; start_frame: number | null; end_frame: number | null }>(
			'SELECT player_id, slot, team, name, short_name, number, role, line, start_frame, end_frame FROM match_players WHERE match_id = ? AND slot IS NOT NULL ORDER BY slot',
			[id]
		),
		query<{ frame: number | null; team: Side; player: string | null; minute: number | null }>(
			'SELECT frame, team, player, minute FROM match_goals WHERE match_id = ? ORDER BY seq',
			[id]
		),
		query<{ frame_end: number; team_id: number; player_name: string; player_id: number; minute_start: number }>(
			"SELECT frame_end, team_id, player_name, player_id, minute_start FROM dynamic_events WHERE match_id = ? AND end_type = 'shot' ORDER BY frame_start",
			[id]
		),
		query<{
			event_id: string;
			frame_start: number;
			frame_end: number;
			team_id: number;
			player_name: string;
			player_id: number;
			event_subtype: string;
			x_start: number;
			y_start: number;
			x_end: number;
			y_end: number;
			minute_start: number;
			targeted: number | null;
			received: number | null;
			dangerous: number | null;
			lead_to_shot: number | null;
			lead_to_goal: number | null;
			attacking_side: string;
		}>(
			`SELECT event_id, frame_start, frame_end, team_id, player_name, player_id, event_subtype,
			        x_start, y_start, x_end, y_end, minute_start,
			        targeted, received, dangerous, lead_to_shot, lead_to_goal, attacking_side
			   FROM dynamic_events
			  WHERE match_id = ? AND event_type = 'off_ball_run'
			  ORDER BY frame_start`,
			[id]
		)
	]);

	const players: MatchPlayer[] = playerRows.map((p) => ({
		slot: p.slot,
		id: Number(p.player_id),
		name: p.name,
		shortName: p.short_name,
		number: p.number,
		team: p.team,
		role: p.role,
		line: p.line,
		startFrame: p.start_frame,
		endFrame: p.end_frame
	}));
	const slotById = new Map(players.map((p) => [p.id, p.slot]));
	const homeId = Number(match.home_team_id);
	const sideOf = (teamId: number): Side => (Number(teamId) === homeId ? 'home' : 'away');
	const goalFrames = new Set(goalRows.map((g) => g.frame).filter((f) => f !== null));

	const shots: MatchShot[] = shotRows.map((s) => ({
		frame: s.frame_end,
		team: sideOf(s.team_id),
		player: s.player_name,
		slot: slotById.get(Number(s.player_id)) ?? null,
		minute: s.minute_start + 1,
		goal: goalFrames.has(s.frame_end)
	}));

	const runs: MatchRun[] = runRows.map((r) => {
		// Event coordinates are normalised so the acting team attacks left-to-right; tracking
		// isn't, so flip both axes back when the team was attacking right-to-left.
		const sign = r.attacking_side === 'right_to_left' ? -1 : 1;
		return {
			id: r.event_id,
			frameStart: r.frame_start,
			frameEnd: r.frame_end,
			team: sideOf(r.team_id),
			player: r.player_name,
			slot: slotById.get(Number(r.player_id)) ?? null,
			subtype: r.event_subtype,
			start: [sign * r.x_start, sign * r.y_start],
			end: [sign * r.x_end, sign * r.y_end],
			minute: r.minute_start + 1,
			targeted: !!r.targeted,
			received: !!r.received,
			dangerous: !!r.dangerous,
			leadToShot: !!r.lead_to_shot,
			leadToGoal: !!r.lead_to_goal
		};
	});

	const meta: MatchMeta = {
		...summary(match),
		competition: match.competition,
		pitch: { length: match.pitch_length, width: match.pitch_width },
		fps: match.fps,
		chunkSize: CHUNK_SIZE,
		nFrames: match.n_frames,
		periods: match.periods,
		homeSide: match.home_side,
		players,
		goals: goalRows.map((g) => ({ frame: g.frame, team: g.team, player: g.player, minute: g.minute }))
	};
	return { meta, events: { shots, runs } };
}
