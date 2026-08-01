export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"scope-enum": [
			2,
			"always",
			[
				"ingestion",
				"dashboard",
				"dashboard-ui",
				"tracker",
				"cli",
				"schema",
				"ua-parser",
				"repo",
			],
		],
		"scope-empty": [2, "never"],
	},
};
