import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import {
	checkAuth,
	fetchBreakdowns,
	fetchOverview,
	fetchSites,
	login,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
	checkAuth: vi.fn(),
	login: vi.fn(),
	logout: vi.fn(),
	fetchOverview: vi.fn(),
	fetchBreakdowns: vi.fn(),
	fetchRealtime: vi.fn(),
	fetchSites: vi.fn(),
	createSite: vi.fn(),
	deleteSite: vi.fn(),
}));

const mockCheckAuth = vi.mocked(checkAuth);
const mockLogin = vi.mocked(login);

function mockMatchMedia() {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}

describe("App", () => {
	beforeEach(() => {
		mockMatchMedia();
		vi.clearAllMocks();
	});

	it("shows the login form when unauthenticated", async () => {
		mockCheckAuth.mockResolvedValue(false);
		render(<App />);
		expect(
			await screen.findByRole("button", { name: "Sign in" }),
		).toBeInTheDocument();
	});

	it("logs in and shows the overview", async () => {
		mockCheckAuth.mockResolvedValue(false);
		mockLogin.mockResolvedValue(undefined);
		vi.mocked(fetchSites).mockResolvedValue([]);
		const mockFetchOverview = vi.mocked(fetchOverview);
		const mockFetchBreakdowns = vi.mocked(fetchBreakdowns);
		mockFetchOverview.mockResolvedValue({
			series: [{ t: "2026-08-01", pageviews: 10 }],
			pageviews: 10,
			uniques: 4,
		});
		mockFetchBreakdowns.mockResolvedValue({
			pages: [],
			referrers: [],
			browsers: [],
			oses: [],
			devices: [],
			countries: [],
			bounce: { bounces: 0, visitors: 0, rate: 0 },
		});
		render(<App />);

		const secret = await screen.findByLabelText("Secret");
		await userEvent.type(secret, "correct-secret");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith("correct-secret");
		});
		expect(
			await screen.findByRole("heading", { name: "Azoth" }),
		).toBeInTheDocument();
	});
});
