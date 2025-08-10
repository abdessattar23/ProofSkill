import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/v1/api': {
				target: 'http://localhost:4000',
				changeOrigin: true,
				secure: false
			}
		}
	}
});
