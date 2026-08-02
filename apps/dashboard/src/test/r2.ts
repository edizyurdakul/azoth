import type { R2Bucket, R2ObjectBody } from "@cloudflare/workers-types";

export function makeMockR2(): R2Bucket & {
	store: Map<string, Uint8Array>;
} {
	const store = new Map<string, Uint8Array>();
	const r2 = {
		store,
		async get(key: string): Promise<R2ObjectBody | null> {
			const body = store.get(key);
			if (!body) {
				return null;
			}
			return {
				key,
				body,
				arrayBuffer: async () => body.buffer.slice(0) as ArrayBuffer,
				size: body.byteLength,
			} as unknown as R2ObjectBody;
		},
		async put(key: string, value: Uint8Array | ArrayBuffer | string) {
			const bytes =
				typeof value === "string"
					? new TextEncoder().encode(value)
					: value instanceof Uint8Array
						? value
						: new Uint8Array(value);
			store.set(key, bytes);
			return {} as R2ObjectBody;
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list() {
			return { objects: [], truncated: false };
		},
	} as unknown as R2Bucket & { store: Map<string, Uint8Array> };
	return r2;
}
