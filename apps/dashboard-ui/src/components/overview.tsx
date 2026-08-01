import { LogOutIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
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
import { ApiError, fetchOverview, logout, type OverviewData } from "@/lib/api";

const SITES_KEY = "azoth_sites";
const SITE_KEY = "azoth_site";

const RANGES = [
	{ label: "7 days", days: 7 },
	{ label: "30 days", days: 30 },
	{ label: "90 days", days: 90 },
] as const;

function loadSites(): string[] {
	try {
		const raw = localStorage.getItem(SITES_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		return Array.isArray(parsed)
			? parsed.filter((site): site is string => typeof site === "string")
			: [];
	} catch {
		return [];
	}
}

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
	const [sites, setSites] = useState<string[]>(() => loadSites());
	const [siteId, setSiteId] = useState<string>(() => loadSelectedSite());
	const [newSite, setNewSite] = useState("");
	const [rangeKey, setRangeKey] = useState<string>(RANGES[1].label);
	const [data, setData] = useState<OverviewData | null>(null);
	const [loading, setLoading] = useState(true);

	const range = useMemo(
		() => RANGES.find((r) => r.label === rangeKey) ?? RANGES[1],
		[rangeKey],
	);

	const refresh = useCallback(
		async (site: string, from: number, to: number) => {
			try {
				const result = await fetchOverview(site, from, to);
				setData(result);
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
		if (siteId === "") {
			setLoading(false);
			setData(null);
			return;
		}
		setLoading(true);
		const to = Date.now();
		const from = to - range.days * 24 * 3600 * 1000;
		void refresh(siteId, from, to);
	}, [siteId, range, refresh]);

	function handleAddSite() {
		const site = newSite.trim();
		if (site === "") {
			return;
		}
		const next = sites.includes(site) ? sites : [...sites, site];
		setSites(next);
		setSiteId(site);
		setNewSite("");
		localStorage.setItem(SITES_KEY, JSON.stringify(next));
		localStorage.setItem(SITE_KEY, site);
	}

	function handleSelectSite(value: string) {
		setSiteId(value);
		localStorage.setItem(SITE_KEY, value);
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
											<SelectItem key={site} value={site}>
												{site}
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
					<div className="grid gap-4 sm:grid-cols-2">
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
					</div>

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
				</>
			)}
		</div>
	);
}
