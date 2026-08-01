import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { BreakdownData, BreakdownItem } from "@/lib/api";

function formatValue(value: number): string {
	return new Intl.NumberFormat().format(value);
}

function BreakdownTable({
	title,
	items,
	emptyLabel,
}: {
	title: string;
	items: BreakdownItem[];
	emptyLabel: string;
}) {
	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-sm font-medium">{title}</h3>
			{items.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">
					{emptyLabel}
				</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead className="text-right">Pageviews</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => (
							<TableRow key={`${title}:${item.name}`}>
								<TableCell className="font-medium">{item.name}</TableCell>
								<TableCell className="text-right">
									{formatValue(item.pageviews)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}

export function Breakdowns({ data }: { data: BreakdownData }) {
	return (
		<div className="grid gap-6 sm:grid-cols-2">
			<BreakdownTable
				title="Top pages"
				items={data.pages}
				emptyLabel="No page data in range."
			/>
			<BreakdownTable
				title="Top referrers"
				items={data.referrers}
				emptyLabel="No referrers in range."
			/>
			<BreakdownTable
				title="Browsers"
				items={data.browsers}
				emptyLabel="No browser data in range."
			/>
			<BreakdownTable
				title="Operating systems"
				items={data.oses}
				emptyLabel="No OS data in range."
			/>
			<BreakdownTable
				title="Devices"
				items={data.devices}
				emptyLabel="No device data in range."
			/>
			<BreakdownTable
				title="Countries"
				items={data.countries}
				emptyLabel="No country data in range."
			/>
		</div>
	);
}
