const GITHUB_RELEASES = 'https://github.com/ExBook/Knowa/releases/download';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const targetPath = url.pathname;

		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}

		const githubUrl = `${GITHUB_RELEASES}${targetPath}`;

		// Check Cloudflare cache first
		const cache = caches.default;
		const cached = await cache.match(request);
		if (cached) return cached;

		// Fetch from GitHub
		const response = await fetch(githubUrl, {
			headers: { 'User-Agent': 'knowa-download-proxy' },
			redirect: 'follow',
		});

		if (!response.ok) {
			return new Response('File not found', { status: 404 });
		}

		// Return an immutable response with long-term CDN cache
		const headers = new Headers(response.headers);
		headers.set('Cache-Control', 'public, max-age=86400, immutable');
		headers.set('Access-Control-Allow-Origin', '*');

		const proxied = new Response(response.body, {
			status: response.status,
			headers,
		});

		ctx.waitUntil(cache.put(request, proxied.clone()));

		return proxied;
	},
};
