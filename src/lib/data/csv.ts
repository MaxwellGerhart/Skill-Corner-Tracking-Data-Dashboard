/** Parses a numeric cell. Empty strings (NULL in the database; SkillCorner's way of marking "no runs of this type") become null. */
export function toNumberOrNull(value: string | undefined): number | null {
	if (value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** Same as {@link toNumberOrNull} but defaults missing/invalid values to 0, for additive counters. */
export function toNumber(value: string | undefined): number {
	return toNumberOrNull(value) ?? 0;
}
