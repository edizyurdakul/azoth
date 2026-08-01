import { useEffect, useState } from "react";
import { ApiError, fetchRealtime, type RealtimeData } from "@/lib/api";

const REFRESH_MS = 30_000;

function formatValue(value: number): string {
	return new Intl.NumberFormat().format(value);
}

function formatWindow(windowMs: number): string {
	const minutes = Math.round(windowMs / 60_000);
	return `last ${minutes} min`;
}

export function RealtimeWidget({
	siteId,
	onUnauthorized,
}: {
	siteId: string;
	onUnauthorized: () => void;
}) {
	const [data, setData] = useState<RealtimeData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const result = await fetchRealtime(siteId);
				if (!cancelled) {
					setData(result);
					setError(null);
				}
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) {
					onUnauthorized();
					return;
				}
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load data");
				}
			}
		}

		void load();
		const timer = setInterval(() => void load(), REFRESH_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [siteId, onUnauthorized]);

	if (data === null) {
		return null;
	}

	return (
		<div className="flex flex-col gap-1">
			<h3 className="text-sm font-medium">Realtime</h3>
			<p className="text-xs text-muted-foreground">
				{formatWindow(data.windowMs)}
			</p>
			<div className="flex items-baseline gap-2">
				<span className="text-3xl font-semibold tracking-tight">
					{formatValue(data.uniques)}
				</span>
				<span className="text-sm text-muted-foreground">visitors</span>
			</div>
			<p className="text-sm text-muted-foreground">
				{formatValue(data.pageviews)} pageviews{error ? ` — ${error}` : ""}
			</p>
		</div>
	);
}
