// import { zzfx } from './third-party/zzfx';

import { GameLoop, initKeys } from 'kontra';
import { Camera } from './renderer/camera';
import { Renderer } from './renderer/renderer';
import { createNode, updateWorldMatrix } from './scene/scene';

async function setupApp() {
	const canvas = document.getElementById('c') as HTMLCanvasElement;

	let aspect = 1;
	function updateCanvasSize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = (canvas.clientWidth * dpr) | 0;
		const h = (canvas.clientHeight * dpr) | 0;

		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			aspect = w / h;
		}
	}
	window.onresize = updateCanvasSize;
	updateCanvasSize();

	let isDragging = false;

	window.onpointerdown = () => (isDragging = true);
	window.onpointerup = () => (isDragging = false);

	window.onpointermove = (e) => {
		if (!isDragging) return;

		camera.yaw -= e.movementX * 0.005;
		camera.pitch += e.movementY * 0.005;
	};

	initKeys();

	if (!navigator.gpu) throw new Error('WebGPU not supported');
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter?.requestDevice();
	if (!device) throw new Error('Failed to create WebGPU device');

	const renderer = new Renderer(canvas, device);

	await renderer.init();

	const sceneRoot = createNode();

	const camera = new Camera();

	const loop = GameLoop({
		clearCanvas: false,

		update(dt) {
			camera.update(aspect);

			updateWorldMatrix(sceneRoot);
		},

		render: () => {
			renderer.render(camera);
		},
	});

	loop.start();
}

void setupApp();
