import {
	cancel,
	confirm,
	intro,
	isCancel,
	note,
	outro,
	password,
	select,
	text,
} from "@clack/prompts";

export function handleCancel<T>(value: T | symbol): T {
	if (isCancel(value)) {
		cancel("Cancelled");
		process.exit(1);
	}
	return value as T;
}

export async function confirmStep(
	message: string,
	initial = true,
): Promise<boolean> {
	return handleCancel(await confirm({ message, initialValue: initial }));
}

export async function selectStep(
	message: string,
	options: Array<{ value: string; label: string; hint?: string }>,
): Promise<string> {
	return handleCancel(await select({ message, options }));
}

export async function textStep(
	message: string,
	opts?: { placeholder?: string; initialValue?: string },
): Promise<string> {
	return handleCancel(await text({ message, ...opts }));
}

export async function passwordStep(message: string): Promise<string> {
	return handleCancel(await password({ message }));
}

export { cancel, intro, note, outro };
