import fs from 'node:fs';
import { Packer } from 'roadroller';
import { execFileSync } from 'child_process';

const getTimestamp = () =>
	new Date().toLocaleString('sv').replace(' ', '_').replace(/:/g, '-');

async function build() {
	fs.mkdirSync('.builds', { recursive: true });

	console.log('[Roadroller] pack JS');
	const html = fs.readFileSync('dist/index.html', 'utf-8');

	const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
	if (!scriptMatch) throw new Error('No script tag found in dist/index.html');

	const packer = new Packer(
		[
			{
				data: scriptMatch[1],
				type: 'js',
				action: 'eval',
			},
		],
		{},
	);

	await packer.optimize();
	const { firstLine, secondLine } = packer.makeDecoder();
	const packedJS = firstLine + secondLine;

	const packedHtml = html.replace(
		/<script[^>]*>[\s\S]*?<\/script>/,
		`<script>${packedJS}</script>`,
	);

	fs.writeFileSync('dist/index.html', packedHtml);

	const zipPath = `.builds/game_${getTimestamp()}.zip`;

	console.log('[ECT] create ZIP file');
	execFileSync('./scripts/ect.exe', [
		'-9',
		'-strip',
		'-zip',
		zipPath,
		'dist/index.html',
	]);

	const bytes = fs.statSync(zipPath).size;
	const limit = 13 * 1024;
	const percent = ((bytes / limit) * 100).toFixed(2);
	const remaining = limit - bytes;

	console.log(`\nZIP file: ${bytes} / ${limit} bytes (${percent}%)`);

	if (remaining >= 0) {
		console.log(`✅ ${remaining} bytes under budget`);
	} else {
		console.error(`❌ Over budget by ${Math.abs(remaining)} bytes`);
	}
}

build();
