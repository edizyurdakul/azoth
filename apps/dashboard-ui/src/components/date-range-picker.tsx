import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
	value: DateRange | undefined;
	onChange: (range: DateRange | undefined) => void;
	className?: string;
}

function formatLabel(range: DateRange | undefined): string {
	if (range?.from === undefined) {
		return "Custom range";
	}
	if (range.to === undefined) {
		return format(range.from, "LLL dd, y");
	}
	if (range.to.getTime() === range.from.getTime()) {
		return format(range.from, "LLL dd, y");
	}
	return `${format(range.from, "LLL dd, y")} – ${format(range.to, "LLL dd, y")}`;
}

export function DateRangePicker({
	value,
	onChange,
	className,
}: DateRangePickerProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" className={cn("gap-2", className)}>
					<CalendarIcon data-icon="inline-start" />
					{formatLabel(value)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					numberOfMonths={2}
					selected={value}
					onSelect={onChange}
					defaultMonth={value?.from}
				/>
			</PopoverContent>
		</Popover>
	);
}
