export interface SnippetParams {
	ingestionUrl: string;
	dashboardUrl: string;
	siteId: string;
}

export function embedSnippet({ ingestionUrl, siteId }: SnippetParams): string {
	return `<script defer src="${ingestionUrl}/tracker.min.js" data-site-id="${siteId}"></script>`;
}

export function testCurl({ ingestionUrl }: SnippetParams): string {
	return `curl -X POST '${ingestionUrl}/collect?siteId=test&path=%2F'`;
}
