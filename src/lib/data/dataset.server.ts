import { query } from '../server/db';
import { toNumber, toNumberOrNull } from './csv';
import { POSITION_GROUPS, type Dataset, type PlayerRecord, type PositionGroup, type RunTypeKey, type RunTypeMetrics } from './types';

const MIN_MATCHES_FLOOR = 5;

const SPECIFIC_RUN_TYPE_PREFIXES = [
	'behindrun',
	'comingshortrun',
	'crossreceiverrun',
	'droppingoffrun',
	'overlaprun',
	'pullinghalfspacerun',
	'pullingwiderun',
	'aheadoftheballrun',
	'supportrun',
	'underlaprun'
] as const;

const RUN_TYPE_PREFIXES = ['offballrun', ...SPECIFIC_RUN_TYPE_PREFIXES] as const;

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

/**
 * Reads a whole season table from TiDB as string records, the same shape the CSV files
 * had, so the cleaning rules below stay byte-for-byte identical (NULL becomes '').
 */
async function readTable(table: 'obr_aggregates' | 'off_ball_runs_clean'): Promise<Record<string, string>[]> {
	const rows = await query<Record<string, unknown>>(`SELECT * FROM ${table}`);
	return rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null ? '' : String(v)])));
}

function buildRunTypeMetrics(row: Record<string, string>, prefix: string): RunTypeMetrics {
	return {
		countPer30: toNumber(row[`${prefix}_count_p30tip`]),
		targetedPer30: toNumber(row[`${prefix}_count_targeted_p30tip`]),
		receivedPer30: toNumber(row[`${prefix}_count_received_p30tip`]),
		dangerousPer30: toNumber(row[`${prefix}_count_dangerous_p30tip`]),
		shotWithin10sPer30: toNumber(row[`${prefix}_count_shotwithin10s_p30tip`]),
		goalWithin10sPer30: toNumber(row[`${prefix}_count_goalwithin10s_p30tip`]),
		aboveHsrPer30: toNumber(row[`${prefix}_count_abovehsr_p30tip`]),
		avgDistanceM: toNumberOrNull(row[`${prefix}_avgdistance`])
	};
}

/** Player ids with a stored headshot; empty until scripts/fetch_headshots.py has run. */
async function loadHeadshotIds(): Promise<Set<string>> {
	try {
		const rows = await query<{ player_id: number }>('SELECT player_id FROM player_headshots');
		return new Set(rows.map((r) => String(r.player_id)));
	} catch {
		return new Set();
	}
}

let cached: Promise<Dataset> | null = null;

/**
 * Loads and cleans the SkillCorner off-ball-runs data from TiDB (loaded there by
 * scripts/load_tidb.py --season). Server-only; the result is cached for the life of the
 * server process because the season data doesn't change between loads.
 *
 * Cleaning rules mirror notebooks/01_off_ball_player_evaluation.ipynb exactly:
 * drop rows with no `minutes` value, drop goalkeepers, keep only player-position pairs
 * with at least {@link MIN_MATCHES_FLOOR} matches.
 */
export function loadDataset(): Promise<Dataset> {
	cached ??= buildDataset().catch((err) => {
		cached = null; // don't cache a failed connection
		throw err;
	});
	return cached;
}

async function buildDataset(): Promise<Dataset> {
	const [raw, processed, headshotIds] = await Promise.all([readTable('obr_aggregates'), readTable('off_ball_runs_clean'), loadHeadshotIds()]);

	const cleanedRaw = raw
		.filter((r) => r.minutes !== '' && r.minutes !== undefined)
		.filter((r) => r.position_group !== 'Goalkeeper')
		.filter((r) => Number(r.performance_included_count) >= MIN_MATCHES_FLOOR);

	const rawByKey = new Map<string, Record<string, string>>();
	for (const r of cleanedRaw) {
		const key = `${r.player_short_name}|${r.team_name}|${r.position_group}`;
		rawByKey.set(key, r);
	}

	const players: PlayerRecord[] = [];
	for (const row of processed) {
		const key = `${row.player}|${row.team}|${row.position}`;
		const rawRow = rawByKey.get(key);
		if (!rawRow) {
			console.warn(`[dataset] no raw match for processed row: ${key}`);
			continue;
		}

		const runTypes = Object.fromEntries(
			RUN_TYPE_PREFIXES.map((prefix) => [prefix, buildRunTypeMetrics(rawRow, prefix)])
		) as Record<RunTypeKey, RunTypeMetrics>;

		players.push({
			id: `${rawRow.player_id}-${slugify(row.position)}`,
			playerId: rawRow.player_id,
			teamId: rawRow.team_id,
			hasHeadshot: headshotIds.has(rawRow.player_id),
			player: row.player,
			team: row.team,
			position: row.position as PositionGroup,
			matches: Number(row.matches),
			minutes: Number(rawRow.minutes),
			minutesTip: Number(rawRow.minutes_tip),
			totalRuns: Number(row.total_runs),
			runsPer30: Number(row.runs_per30),
			dangerousRunsPer30: Number(row.dangerous_runs_per30),
			pctDangerous: Number(row.pct_dangerous),
			pctPassedTo: Number(row.pct_passed_to),
			pctReceived: Number(row.pct_received),
			runsInBehindPer30: Number(row.runs_in_behind_per30),
			highSpeedRunsPer30: Number(row.high_speed_runs_per30),
			avgRunLengthM: Number(row.avg_run_length_m),
			runTypes
		});
	}

	players.sort((a, b) => b.dangerousRunsPer30 - a.dangerousRunsPer30);

	const teams = [...new Set(players.map((p) => p.team))].sort((a, b) => a.localeCompare(b));
	const positions = POSITION_GROUPS.filter((pos) => players.some((p) => p.position === pos));

	return {
		players,
		positions,
		teams,
		meta: {
			season: '2024/2025',
			competition: 'A-League',
			minMatchesFloor: MIN_MATCHES_FLOOR,
			maxMatches: Math.max(...players.map((p) => p.matches)),
			playerCount: new Set(players.map((p) => p.playerId)).size,
			teamCount: teams.length
		}
	};
}
