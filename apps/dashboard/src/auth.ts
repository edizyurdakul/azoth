export interface AuthEnv {
	AUTH_SECRET: string;
}

export function isAuthorized(request: Request, env: AuthEnv): boolean {
	const provided = request.headers.get("authorization");
	if (provided === null) {
		return false;
	}
	const expected = `Bearer ${env.AUTH_SECRET}`;
	const a = new TextEncoder().encode(provided);
	const b = new TextEncoder().encode(expected);
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}
