// import { zzfx } from './third-party/zzfx';

import { GameLoop, initKeys, keyMap, keyPressed } from 'kontra';
import * as cam from './renderer/camera';
import * as render from './renderer/renderer';
import { Renderer } from './renderer/renderer';
import * as scene from './scene/scene';

let camHMR = cam;
let sceneHMR = scene;
let renderHMR = render;
if (import.meta.hot) {
	import.meta.hot.accept('./renderer/camera', (mod) => {
		// @ts-expect-error -- ignore
		if (mod) camHMR = mod;
	});
	import.meta.hot.accept('./scene/scene', (mod) => {
		// @ts-expect-error -- ignore
		if (mod) sceneHMR = mod;
	});
	import.meta.hot.accept('./renderer/renderer', (mod) => {
		// @ts-expect-error -- ignore
		if (mod) renderHMR = mod;
	});
}

async function setupApp() {
	const canvas = document.getElementById('c') as HTMLCanvasElement;

	let aspect = 1;
	function updateCanvasSize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = (canvas.clientWidth * dpr) | 0;
		const h = (canvas.clientHeight * dpr) | 0;
		aspect = w / h;

		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			aspect = w / h;
		}

		renderer.onCanvasSizeUpdate();
	}

	let isDragging = false;

	window.onpointerdown = () => (isDragging = true);
	window.onpointerup = () => (isDragging = false);

	window.onpointermove = (e) => {
		if (!isDragging) return;

		camera.yaw -= e.movementX * 0.005;
		camera.pitch += e.movementY * 0.005;
	};

	initKeys();
	keyMap.ShiftLeft = 'shiftleft';

	if (!navigator.gpu) throw new Error('WebGPU not supported');
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter?.requestDevice();
	if (!device) throw new Error('Failed to create WebGPU device');

	const renderer = new Renderer(canvas, device);
	await renderer.init();
	updateCanvasSize();

	window.onresize = updateCanvasSize;

	const sceneRoot = sceneHMR.createNode();
	sceneRoot.shouldRender = false;

	const player = sceneHMR.createPlayer();
	sceneRoot.children.push(player.root);

	sceneHMR.createWorld(sceneRoot);

	const camera = camHMR.create();

	function postUpdate(dt: number) {
		camHMR.update(camera, aspect);

		sceneHMR.updateWorldMatrix(sceneRoot);
		renderHMR.updateTime(dt);
	}

	camHMR.follow(
		camera,
		[player.root.pos[0], player.root.pos[1] + 1.2, player.root.pos[2]],
		0,
		1,
		1,
		Infinity,
		Infinity,
	);

	const loop = GameLoop({
		clearCanvas: false,

		blur: true,

		update(dt) {
			let charging = keyPressed('shiftleft');
			sceneHMR.updatePlayer(player, camera, dt);

			cam.follow(
				camera,
				[
					player.root.pos[0],
					player.root.pos[1] + 1.2,
					player.root.pos[2],
				],
				player.root.rot[1],
				1,
				dt,
				6,
				charging ? 5 : 1.5,
			);

			postUpdate(dt);
		},

		render: () => {
			renderHMR.render(renderer, sceneRoot, camera);
		},
	});

	loop.start();
}

void setupApp();
