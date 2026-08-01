import { LogInIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, login } from "@/lib/api";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
	const [secret, setSecret] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await login(secret);
			onSuccess();
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				setError("Invalid secret");
			} else {
				const message = err instanceof Error ? err.message : "Sign in failed";
				setError(message);
				toast.error(message);
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Card className="mx-auto w-full max-w-sm">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>
					Enter your dashboard secret to continue.
				</CardDescription>
			</CardHeader>
			<form onSubmit={handleSubmit}>
				<CardContent>
					<FieldGroup>
						<Field data-invalid={error !== null}>
							<FieldLabel htmlFor="secret">Secret</FieldLabel>
							<Input
								id="secret"
								type="password"
								autoComplete="current-password"
								value={secret}
								onChange={(event) => setSecret(event.target.value)}
								aria-invalid={error !== null}
								disabled={submitting}
								required
							/>
							<FieldError>{error}</FieldError>
						</Field>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<Button type="submit" disabled={submitting} className="w-full">
						<LogInIcon data-icon="inline-start" />
						{submitting ? "Signing in…" : "Sign in"}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
