import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { LoginForm } from "@/components/login-form";
import { Overview } from "@/components/overview";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { checkAuth } from "@/lib/api";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export default function App() {
	const [authState, setAuthState] = useState<AuthState>("checking");

	useEffect(() => {
		let active = true;
		void checkAuth().then((ok) => {
			if (active) {
				setAuthState(ok ? "authenticated" : "unauthenticated");
			}
		});
		return () => {
			active = false;
		};
	}, []);

	return (
		<ThemeProvider>
			<div className="flex min-h-screen flex-col bg-background text-foreground">
				<header className="flex items-center justify-between p-4">
					<span className="text-sm font-semibold">Azoth</span>
					<ThemeToggle />
				</header>
				<main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
					{authState === "checking" ? null : authState === "authenticated" ? (
						<Overview onUnauthorized={() => setAuthState("unauthenticated")} />
					) : (
						<LoginForm onSuccess={() => setAuthState("authenticated")} />
					)}
				</main>
			</div>
			<Toaster />
		</ThemeProvider>
	);
}
