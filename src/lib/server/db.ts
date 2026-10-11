import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';

const ENV_KEY = 'SKILLCORNER_TIDB_URL';

/**
 * The connection string comes from this project's .env file whenever one exists, ahead of
 * process environment variables — so a database URL exported in the shell for another
 * project can never be picked up locally. Deployed builds (no .env file) read the
 * SKILLCORNER_TIDB_URL secret from the host's environment instead.
 */
function connectionUrl(): string {
	const file = join(process.cwd(), '.env');
	if (existsSync(file)) {
		for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (trimmed.startsWith(`${ENV_KEY}=`)) return trimmed.slice(ENV_KEY.length + 1).trim().replace(/^['"]|['"]$/g, '');
		}
	}
	const fromEnv = process.env[ENV_KEY];
	if (fromEnv) return fromEnv;
	throw new Error(`${ENV_KEY} is not set. Add it to .env (see README).`);
}

let pool: mysql.Pool | null = null;

export function db(): mysql.Pool {
	if (pool) return pool;
	const url = new URL(connectionUrl());
	const database = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'skillcorner';
	console.info(`[db] TiDB ${decodeURIComponent(url.username)} @ ${url.hostname}:${url.port || 4000} / ${database}`);
	pool = mysql.createPool({
		host: url.hostname,
		port: Number(url.port || 4000),
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database,
		// TiDB Cloud Serverless only accepts TLS connections.
		ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
		connectionLimit: 4,
		maxIdle: 2,
		idleTimeout: 60_000,
		enableKeepAlive: true,
		supportBigNumbers: true,
		dateStrings: true
	});
	return pool;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
	const [rows] = await db().query(sql, params);
	return rows as T[];
}
