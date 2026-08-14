// import { zzfx } from './third-party/zzfx';

import { GameLoop, initKeys } from 'kontra';
import type { SceneNode } from '~/scene/scene-node';
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

		renderer.onCanvasSizeUpdate();
	}
	window.onresize = updateCanvasSize;

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

	updateCanvasSize();

	const sceneRoot = createNode();
	const cubes: SceneNode[] = [];
	for (let x = -1; x <= 1; ++x) {
		const cube = createNode(x * 1.2);
		cube.parent = sceneRoot;
		cubes.push(cube);
	}
	sceneRoot.children.push(...cubes);

	const subCube = createNode(0, 1.2);
	subCube.scale[0] = 0.5;
	subCube.scale[1] = 0.5;
	subCube.scale[2] = 0.5;
	subCube.parent = cubes[1];
	cubes[1].children.push(subCube);

	const camera = new Camera();

	const loop = GameLoop({
		clearCanvas: false,

		update(dt) {
			camera.update(aspect);

			cubes[1].rot[0] += dt;
			cubes[1].isDirty = true;

			subCube.rot[1] -= dt;
			subCube.isDirty = true;

			sceneRoot.rot[1] += dt * 0.2;
			sceneRoot.isDirty = true;

			updateWorldMatrix(sceneRoot);
		},

		render: () => {
			renderer.render(sceneRoot, camera);
		},
	});

	loop.start();
}

void setupApp();
