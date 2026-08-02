import { endOfDay, startOfDay } from "date-fns";
import { CopyIcon, LogOutIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import { Breakdowns } from "@/components/breakdowns";
import { DateRangePicker } from "@/components/date-range-picker";
import { RealtimeWidget } from "@/components/realtime-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ApiError,
	type BreakdownData,
	createSite,
	deleteSite,
	fetchBreakdowns,
	fetchOverview,
	fetchSites,
	fetchUsage,
	logout,
	type OverviewData,
	type Site,
	type UsageData,
} from "@/lib/api";

const SITE_KEY = "azoth_site";

const RANGES = [
	{ label: "7 days", days: 7 },
	{ label: "30 days", days: 30 },
	{ label: "90 days", days: 90 },
	{ label: "Custom", days: null },
] as const;

function loadSelectedSite(): string {
	return localStorage.getItem(SITE_KEY) ?? "";
}

function formatTick(value: string | number): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return String(value);
	}
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatValue(value: number): string {
	return new Intl.NumberFormat().format(value);
}

export function Overview({ onUnauthorized }: { onUnauthorized: () => void }) {
	const [sites, setSites] = useState<Site[]>([]);
	const [siteId, setSiteId] = useState<string>(() => loadSelectedSite());
	const [newSite, setNewSite] = useState("");
	const [snippet, setSnippet] = useState("");
	const [rangeKey, setRangeKey] = useState<string>(RANGES[1].label);
	const [customRange, setCustomRange] = useState<DateRange | undefined>();
	const [data, setData] = useState<OverviewData | null>(null);
	const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
	const [usage, setUsage] = useState<UsageData | null>(null);
	const [loading, setLoading] = useState(true);

	const range = useMemo(
		() => RANGES.find((r) => r.label === rangeKey) ?? RANGES[1],
		[rangeKey],
	);

	const defaultDays = RANGES.find((r) => r.days !== null)?.days ?? 30;

	const fromTo = useMemo((): { from: number; to: number } => {
		const to = Date.now();
		if (range.days === null) {
			if (customRange?.from !== undefined && customRange.to !== undefined) {
				return {
					from: startOfDay(customRange.from).getTime(),
					to: endOfDay(customRange.to).getTime(),
				};
			}
			return { from: to - defaultDays * 24 * 3600 * 1000, to };
		}
		return { from: to - range.days * 24 * 3600 * 1000, to };
	}, [range, customRange, defaultDays]);

	const refresh = useCallback(
		async (site: string, from: number, to: number) => {
			try {
				const [overview, breakdowns] = await Promise.all([
					fetchOverview(site, from, to),
					fetchBreakdowns(site, from, to),
				]);
				setData(overview);
				setBreakdown(breakdowns);
				setLoading(false);
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) {
					onUnauthorized();
					return;
				}
				setLoading(false);
				toast.error(err instanceof Error ? err.message : "Failed to load data");
			}
		},
		[onUnauthorized],
	);

	useEffect(() => {
		let active = true;
		void fetchSites()
			.then((loaded) => {
				if (!active) {
					return;
				}
				setSites(loaded);
				if (siteId === "") {
					setSiteId(loaded[0]?.siteId ?? "");
				}
			})
			.catch((err) => {
				if (err instanceof ApiError && err.status === 401) {
					onUnauthorized();
				} else if (active) {
					toast.error(
						err instanceof Error ? err.message : "Failed to load sites",
					);
				}
			});
		return () => {
			active = false;
		};
	}, [onUnauthorized, siteId]);

	useEffect(() => {
		if (siteId === "") {
			setLoading(false);
			setData(null);
			setBreakdown(null);
			setUsage(null);
			return;
		}
		setLoading(true);
		const { from, to } = fromTo;
		void refresh(siteId, from, to);
		void fetchUsage(from, to)
			.then(setUsage)
			.catch((err) => {
				if (err instanceof ApiError && err.status === 401) {
					onUnauthorized();
				}
			});
	}, [siteId, fromTo, refresh, onUnauthorized]);

	function handleAddSite() {
		const name = newSite.trim();
		if (name === "") {
			return;
		}
		void createSite(name)
			.then(({ site, snippet: newSnippet }) => {
				setSites((prev) => [...prev, site]);
				setSiteId(site.siteId);
				setSnippet(newSnippet ?? "");
				setNewSite("");
			})
			.catch((err) => {
				if (err instanceof ApiError && err.status === 401) {
					onUnauthorized();
				} else {
					toast.error(
						err instanceof Error ? err.message : "Failed to create site",
					);
				}
			});
	}

	async function handleSelectSite(value: string) {
		setSiteId(value);
		setSnippet(sites.find((s) => s.siteId === value)?.snippet ?? "");
		localStorage.setItem(SITE_KEY, value);
	}

	async function handleDeleteSite() {
		if (siteId === "") {
			return;
		}
		try {
			await deleteSite(siteId);
			const next = sites.filter((s) => s.siteId !== siteId);
			setSites(next);
			setSnippet("");
			const fallback = next[0]?.siteId ?? "";
			setSiteId(fallback);
			localStorage.setItem(SITE_KEY, fallback);
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				onUnauthorized();
			} else {
				toast.error(
					err instanceof Error ? err.message : "Failed to delete site",
				);
			}
		}
	}

	function handleCopySnippet() {
		void navigator.clipboard.writeText(snippet).then(
			() => toast.success("Snippet copied"),
			() => toast.error("Failed to copy snippet"),
		);
	}

	async function handleLogout() {
		try {
			await logout();
		} finally {
			onUnauthorized();
		}
	}

	const chartConfig = {
		pageviews: {
			label: "Pageviews",
			color: "var(--chart-1)",
		},
	} satisfies ChartConfig;

	const hasSites = sites.length > 0;

	return (
		<div className="flex w-full max-w-5xl flex-col gap-6">
			<header className="flex items-center justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Azoth</h1>
					<p className="text-sm text-muted-foreground">Site analytics</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={handleLogout}>
						<LogOutIcon data-icon="inline-start" />
						Log out
					</Button>
				</div>
			</header>

			<section className="flex flex-col gap-3">
				<FieldGroup>
					<Field orientation="horizontal" className="items-center gap-2">
						<FieldLabel className="w-auto">Site</FieldLabel>
						{hasSites ? (
							<Select value={siteId} onValueChange={handleSelectSite}>
								<SelectTrigger className="w-48" aria-label="Select site">
									<SelectValue placeholder="Select a site" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{sites.map((site) => (
											<SelectItem key={site.siteId} value={site.siteId}>
												{site.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						) : (
							<Input
								value={siteId}
								onChange={(event) => {
									setSiteId(event.target.value);
									localStorage.setItem(SITE_KEY, event.target.value);
								}}
								placeholder="my-site"
								className="w-48"
								aria-label="Site ID"
							/>
						)}
						{sites.length > 0 && (
							<Button
								variant="outline"
								size="icon"
								onClick={handleDeleteSite}
								aria-label="Delete site"
							>
								<Trash2Icon data-icon="inline-start" />
							</Button>
						)}
						<Input
							value={newSite}
							onChange={(event) => setNewSite(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									handleAddSite();
								}
							}}
							placeholder="Add a site"
							className="w-40"
							aria-label="Add site"
						/>
						<Button
							variant="outline"
							size="icon"
							onClick={handleAddSite}
							aria-label="Add site"
						>
							<PlusIcon data-icon="inline-start" />
						</Button>
					</Field>
				</FieldGroup>
				{snippet !== "" && (
					<Field>
						<FieldLabel className="w-auto">Embed snippet</FieldLabel>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
								{snippet}
							</code>
							<Button
								variant="outline"
								size="icon"
								onClick={handleCopySnippet}
								aria-label="Copy snippet"
							>
								<CopyIcon data-icon="inline-start" />
							</Button>
						</div>
					</Field>
				)}
			</section>

			<Tabs value={rangeKey} onValueChange={setRangeKey}>
				<TabsList>
					{RANGES.map((r) => (
						<TabsTrigger key={r.label} value={r.label}>
							{r.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{rangeKey === "Custom" && (
				<DateRangePicker
					value={customRange}
					onChange={setCustomRange}
					className="w-fit"
				/>
			)}

			{loading ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
					<Skeleton className="h-64 sm:col-span-2" />
				</div>
			) : data === null ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground">
						Enter a site ID to view analytics.
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Card>
							<CardHeader>
								<CardTitle>Pageviews</CardTitle>
							</CardHeader>
							<CardContent className="flex items-baseline gap-2">
								<span className="text-3xl font-semibold tracking-tight">
									{formatValue(data.pageviews)}
								</span>
								<Badge variant="secondary">total</Badge>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Unique visitors</CardTitle>
							</CardHeader>
							<CardContent className="flex items-baseline gap-2">
								<span className="text-3xl font-semibold tracking-tight">
									{formatValue(data.uniques)}
								</span>
								<Badge variant="secondary">in range</Badge>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Bounce rate</CardTitle>
							</CardHeader>
							<CardContent className="flex items-baseline gap-2">
								<span className="text-3xl font-semibold tracking-tight">
									{breakdown === null
										? "–"
										: `${Math.round(breakdown.bounce.rate * 100)}%`}
								</span>
								<Badge variant="secondary">
									{breakdown === null
										? "loading"
										: `${breakdown.bounce.bounces}/${breakdown.bounce.visitors} visitors`}
								</Badge>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Realtime</CardTitle>
							</CardHeader>
							<CardContent>
								<RealtimeWidget
									siteId={siteId}
									onUnauthorized={onUnauthorized}
								/>
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Analytics Engine usage</CardTitle>
						</CardHeader>
						<CardContent className="flex items-baseline gap-2">
							<span className="text-3xl font-semibold tracking-tight">
								{usage === null ? "–" : formatValue(usage.total)}
							</span>
							<Badge variant="secondary">events in range (all sites)</Badge>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Pageviews over time</CardTitle>
						</CardHeader>
						<CardContent>
							<ChartContainer
								config={chartConfig}
								className="aspect-auto h-64 w-full"
							>
								<AreaChart data={data.series} margin={{ left: 12, right: 12 }}>
									<CartesianGrid vertical={false} />
									<XAxis
										dataKey="t"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tickFormatter={formatTick}
										minTickGap={32}
									/>
									<ChartTooltip
										cursor={false}
										content={<ChartTooltipContent indicator="dot" />}
									/>
									<Area
										dataKey="pageviews"
										type="natural"
										fill="var(--color-pageviews)"
										stroke="var(--color-pageviews)"
										fillOpacity={0.2}
									/>
								</AreaChart>
							</ChartContainer>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Breakdowns</CardTitle>
						</CardHeader>
						<CardContent>
							{breakdown === null ? (
								<Skeleton className="h-64" />
							) : (
								<Breakdowns data={breakdown} />
							)}
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}
