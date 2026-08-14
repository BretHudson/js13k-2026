import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
	plugins: [glsl({ minify: true }), viteSingleFile()],
	build: {
		target: 'esnext',
	},
});
