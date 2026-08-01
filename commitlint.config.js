export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"scope-enum": [
			2,
			"always",
			["ingestion", "dashboard", "tracker", "schema", "ua-parser", "repo"],
		],
		"scope-empty": [2, "never"],
	},
};
