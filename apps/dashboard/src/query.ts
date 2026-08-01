const SQL_API_BASE =
	"https://api.cloudflare.com/client/v4/accounts/%s/analytics_engine/sql";

export interface QueryEnv {
	CF_ACCOUNT_ID: string;
	CF_API_TOKEN: string;
}

export interface QueryRow {
	[column: string]: string | number | null;
}

export interface QueryResult {
	data: QueryRow[];
	rows: number;
}

export class QueryError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown,
	) {
		super(message);
	}
}

export async function queryAnalytics(
	env: QueryEnv,
	sql: string,
	fetchFn: typeof fetch = fetch,
): Promise<QueryResult> {
	const url = SQL_API_BASE.replace("%s", env.CF_ACCOUNT_ID);
	const response = await fetchFn(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.CF_API_TOKEN}`,
		},
		body: sql,
	});

	if (!response.ok) {
		throw new QueryError(
			`Analytics Engine query failed with status ${response.status}`,
			response.status,
			await response.text(),
		);
	}

	const json = (await response.json()) as QueryResult;
	return {
		data: json.data ?? [],
		rows: json.rows ?? 0,
	};
}
