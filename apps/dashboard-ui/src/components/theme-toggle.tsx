import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
	const { setTheme, resolvedTheme } = useTheme();
	const dark = resolvedTheme === "dark";

	return (
		<Button
			variant="outline"
			size="icon"
			onClick={() => setTheme(dark ? "light" : "dark")}
			aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{dark ? (
				<SunIcon data-icon="inline-start" />
			) : (
				<MoonIcon data-icon="inline-start" />
			)}
		</Button>
	);
}
