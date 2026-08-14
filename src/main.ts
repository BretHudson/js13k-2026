// import { zzfx } from './third-party/zzfx';

import { GameLoop, initKeys, keyMap, keyPressed } from 'kontra';
import type { SceneNode } from '~/scene/scene-node';
import * as cam from './renderer/camera';
import { Renderer } from './renderer/renderer';
import * as render from './renderer/renderer';
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
		const rawW = (canvas.clientWidth * dpr) | 0;
		const rawH = (canvas.clientHeight * dpr) | 0;
		aspect = rawW / rawH;

		let w = 320,
			h = 240;
		if (aspect > w / h) {
			w = Math.round(h * aspect);
		} else {
			h = Math.round(w / aspect);
		}

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
	keyMap.ShiftLeft = 'shiftleft';

	if (!navigator.gpu) throw new Error('WebGPU not supported');
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter?.requestDevice();
	if (!device) throw new Error('Failed to create WebGPU device');

	const renderer = new Renderer(canvas, device);
	await renderer.init();

	updateCanvasSize();

	const sceneRoot = sceneHMR.createNode();
	sceneRoot.shouldRender = false;

	const playerNode = scene.createPlayer();
	sceneRoot.children.push(playerNode);

	sceneHMR.createWorld(sceneRoot);

	const camera = camHMR.create();

	function postUpdate() {
		camHMR.update(camera, aspect);

		sceneHMR.updateWorldMatrix(sceneRoot);
	}

	camHMR.follow(
		camera,
		[playerNode.pos[0], playerNode.pos[1] + 1.2, playerNode.pos[2]],
		0,
		1,
		1,
		Infinity,
		Infinity,
	);

	let vx = 0,
		vy = 0,
		vz = 0;
	let gravity = 32;

	const loop = GameLoop({
		clearCanvas: false,

		update(dt) {
			let ix = 0;
			let iz = 0;
			if (keyPressed('a') || keyPressed('arrowleft')) ix -= 1;
			if (keyPressed('d') || keyPressed('arrowright')) ix += 1;
			if (keyPressed('w') || keyPressed('arrowup')) iz -= 1;
			if (keyPressed('s') || keyPressed('arrowdown')) iz += 1;

			let charging = keyPressed('shiftleft');
			if (charging && iz === 0) iz = -1;

			const onGround = playerNode.pos[1] < 0.001;

			const a =
				Math.atan2(camera.forward[2], camera.forward[0]) + Math.PI / 2;
			const c = Math.cos(a);
			const s = Math.sin(a);
			let dx = ix * c - iz * s;
			let dz = ix * s + iz * c;

			const hasInput = ix !== 0 || iz !== 0;
			if (hasInput) {
				const invLen = 1 / Math.hypot(dx, dz);
				dx *= invLen;
				dz *= invLen;
			}

			const maxSpeed = charging ? 16 : 7;
			const targetVx = hasInput ? dx * maxSpeed : 0;
			const targetVz = hasInput ? dz * maxSpeed : 0;

			const response = onGround ? (charging ? 10 : 20) : 6;
			const decay = 1 - Math.exp(-response * dt);

			vx += (targetVx - vx) * decay;
			vz += (targetVz - vz) * decay;

			const horizSpeed = Math.hypot(vx, vz);
			if (horizSpeed > 0.1) {
				const targetAngle = Math.atan2(vx, vz);

				let diff = (targetAngle - playerNode.rot[1]) % (Math.PI * 2);
				diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

				const turnSpeed = charging ? 8 : 20;
				playerNode.rot[1] += diff * (1 - Math.exp(-turnSpeed * dt));
			}

			if (keyPressed('space') && onGround) {
				vy = Math.sqrt(2 * gravity * 1.5);
			}

			const applyGravity = !onGround;
			if (applyGravity) vy -= gravity * dt * 0.5;

			playerNode.pos[0] += vx * dt;
			playerNode.pos[1] += vy * dt;
			playerNode.pos[2] += vz * dt;

			if (playerNode.pos[1] < 0) {
				playerNode.pos[1] = 0;
				vy = 0;
			}

			if (applyGravity) vy -= gravity * dt * 0.5;

			playerNode.isDirty = true;

			cam.follow(
				camera,
				[playerNode.pos[0], playerNode.pos[1] + 1.2, playerNode.pos[2]],
				playerNode.rot[1],
				1,
				dt,
				6,
				charging ? 5 : 1.5,
			);

			postUpdate();
		},

		render: () => {
			renderer.render(sceneRoot, camera);
		},
	});

	loop.start();
}

void setupApp();
