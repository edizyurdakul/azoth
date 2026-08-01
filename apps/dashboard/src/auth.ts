export const AUTH_COOKIE = "azoth_auth";

export interface AuthEnv {
	AUTH_SECRET: string;
}

function constantTimeEqual(a: string, b: string): boolean {
	const aBytes = new TextEncoder().encode(a);
	const bBytes = new TextEncoder().encode(b);
	if (aBytes.length !== bBytes.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < aBytes.length; i++) {
		diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	}
	return diff === 0;
}

export function isAuthorized(request: Request, env: AuthEnv): boolean {
	const header = request.headers.get("authorization");
	if (
		header !== null &&
		constantTimeEqual(header, `Bearer ${env.AUTH_SECRET}`)
	) {
		return true;
	}
	const cookie = request.headers
		.get("cookie")
		?.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${AUTH_COOKIE}=`))
		?.slice(AUTH_COOKIE.length + 1);
	return cookie !== undefined && constantTimeEqual(cookie, env.AUTH_SECRET);
}

export function authCookie(secret: string): string {
	return `${AUTH_COOKIE}=${secret}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000; Secure`;
}

export function clearAuthCookie(): string {
	return `${AUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure`;
}
