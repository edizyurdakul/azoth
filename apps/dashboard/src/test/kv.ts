import type { KVNamespace } from "@cloudflare/workers-types";

export interface MockKey {
	name: string;
}

export function makeMockKV(
	initial: Record<string, string> = {},
): KVNamespace & {
	store: Map<string, string>;
} {
	const store = new Map<string, string>(Object.entries(initial));
	const kv = {
		store,
		async get(key: string) {
			return store.get(key) ?? null;
		},
		async put(key: string, value: string) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list(options?: { prefix?: string }) {
			const prefix = options?.prefix ?? "";
			const keys: MockKey[] = [];
			for (const key of store.keys()) {
				if (key.startsWith(prefix)) {
					keys.push({ name: key });
				}
			}
			return { keys, list_complete: true };
		},
	} as KVNamespace & { store: Map<string, string> };
	return kv;
}
