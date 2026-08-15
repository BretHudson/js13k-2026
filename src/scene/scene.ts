import type { Camera } from '~/renderer/camera';
import type { SceneNode } from '~/scene/scene-node';
import type { Mat4 } from '~/util/mat4';
import * as mat4 from '../util/mat4';
import { keyPressed } from 'kontra';

export function createNode(x = 0, y = 0, z = 0): SceneNode {
	return {
		pos: [x, y, z],
		rot: [0, 0, 0],
		scale: [1, 1, 1],
		origin: [0, 0, 0],

		color: [1, 1, 0],

		localMatrix: mat4.create(),
		worldMatrix: mat4.create(),

		children: [],
		isDirty: true,

		useUV: true,
		shouldRender: true,
	};
}

export function updateWorldMatrix(node: SceneNode, parentWorld?: Mat4) {
	if (node.isDirty) {
		// prettier-ignore
		mat4.fromTRS(
			node.localMatrix,
			node.pos[0], node.pos[1], node.pos[2],
			node.rot[0], node.rot[1], node.rot[2],
			node.scale[0], node.scale[1], node.scale[2],
			node.origin[0], node.origin[1], node.origin[2],
		);

		node.isDirty = false;
	}

	if (parentWorld) {
		mat4.multiply(node.worldMatrix, parentWorld, node.localMatrix);
	} else {
		node.worldMatrix.set(node.localMatrix);
	}

	for (let i = 0; i < node.children.length; ++i) {
		updateWorldMatrix(node.children[i], node.worldMatrix);
	}
}

interface Player {
	root: SceneNode;
	head: SceneNode;
	legFL: SceneNode;
	legFR: SceneNode;
	legBL: SceneNode;
	legBR: SceneNode;
}

export function createPlayer(): Player {
	const playerRoot = createNode();
	playerRoot.scale[0] = playerRoot.scale[1] = playerRoot.scale[2] = 2.3;
	playerRoot.shouldRender = false;

	const addPart = (
		x = 0,
		y = 0,
		z = 0,
		sx = 1,
		sy = 1,
		sz = 1,
		parent = playerRoot,
	) => {
		const node = createNode(x, y, z);
		node.scale[0] = sx;
		node.scale[1] = sy;
		node.scale[2] = sz;
		node.color[0] = 1;
		node.color[1] = 1;
		node.color[2] = 1;
		node.useUV = false;
		node.parent = parent;
		parent.children.push(node);
		return node;
	};

	addPart(0, 0.45, 0, 0.45, 0.35, 0.6); // Torso
	addPart(0, 0.65, 0.2, 0.2, 0.35, 0.2); // Neck

	const head = addPart(0, 0.85, 0.35, 0.3, 0.3, 0.4);
	const horn = addPart(0, 0.5, 0.5, 0.06 / 0.3, 0.55 / 0.3, 0.06 / 0.4, head);
	horn.rot[0] = Math.PI / 5;

	const legFL = addPart(-0.18, 0.22, 0.2, 0.12, 0.45, 0.12);
	const legFR = addPart(0.18, 0.22, 0.2, 0.12, 0.45, 0.12);
	const legBL = addPart(-0.2, 0.22, -0.2, 0.14, 0.45, 0.14);
	const legBR = addPart(0.2, 0.22, -0.2, 0.14, 0.45, 0.14);

	legFL.origin[1] = 0.5;
	legFR.origin[1] = 0.5;
	legBL.origin[1] = 0.5;
	legBR.origin[1] = 0.5;

	const tail = addPart(0, 0.35, -0.32, 0.1, 0.45, 0.12);
	tail.rot[0] = Math.PI / 12;

	return { root: playerRoot, head, legFL, legFR, legBL, legBR };
}

export function createWorld(sceneRoot: SceneNode) {
	{
		const floor = createNode(0, -50);
		floor.scale[0] = floor.scale[1] = floor.scale[2] = 100;
		floor.rot[0] = Math.PI;
		sceneRoot.children.push(floor);
		floor.parent = sceneRoot;
	}

	{
		const skybox = createNode(0, -1);
		skybox.scale[0] = skybox.scale[1] = skybox.scale[2] = -100;
		skybox.rot[1] = Math.PI;
		sceneRoot.children.push(skybox);
		skybox.parent = sceneRoot;
	}
}

const FRAMES_TROT_ROTX = [
	{ legFL: 0.4, legFR: -0.4, head: 0.05 },
	{ legFL: 0.2, legFR: -0.2, head: 0.025 },
	{ legFL: 0.0, legFR: 0.0, head: 0.0 },
	{ legFL: -0.2, legFR: 0.2, head: -0.025 },
	{ legFL: -0.4, legFR: 0.4, head: -0.05 },
	{ legFL: -0.2, legFR: 0.2, head: -0.025 },
	{ legFL: 0.0, legFR: 0.0, head: 0.0 },
	{ legFL: 0.2, legFR: -0.2, head: 0.025 },
];

function applyPose(player: Player, frame: (typeof FRAMES_TROT_ROTX)[number]) {
	const { head, legFL, legFR, legBL, legBR } = player;

	head.rot[0] = frame.head;

	legFL.rot[0] = frame.legFL;
	legFR.rot[0] = frame.legFR;

	legBL.rot[0] = frame.legFR;
	legBR.rot[0] = frame.legFL;

	head.isDirty = true;
	legFL.isDirty = true;
	legFR.isDirty = true;
	legBL.isDirty = true;
	legBR.isDirty = true;
}

export function applyPlayerRestPose(player: Player) {
	applyPose(player, FRAMES_TROT_ROTX[2]);
}

export function applyPlayerWalkAnim(player: Player, elapsed: number) {
	const fps = 60 / 4; // 15
	const index = Math.floor(elapsed * fps) % FRAMES_TROT_ROTX.length;

	applyPose(player, FRAMES_TROT_ROTX[index]);
}

let vx = 0,
	vy = 0,
	vz = 0;
let gravity = 32;
let elapsed = 0;
export function updatePlayer(player: Player, camera: Camera, dt: number) {
	elapsed += dt;

	let ix = 0;
	let iz = 0;
	if (keyPressed('a') || keyPressed('arrowleft')) ix -= 1;
	if (keyPressed('d') || keyPressed('arrowright')) ix += 1;
	if (keyPressed('w') || keyPressed('arrowup')) iz -= 1;
	if (keyPressed('s') || keyPressed('arrowdown')) iz += 1;

	let charging = keyPressed('shiftleft');
	if (charging && iz === 0) iz = -1;

	const onGround = player.root.pos[1] < 0.001;

	const a = Math.atan2(camera.forward[2], camera.forward[0]) + Math.PI / 2;
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

		let diff = (targetAngle - player.root.rot[1]) % (Math.PI * 2);
		diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

		const turnSpeed = charging ? 8 : 20;
		player.root.rot[1] += diff * (1 - Math.exp(-turnSpeed * dt));
	}

	if (keyPressed('space') && onGround) {
		vy = Math.sqrt(2 * gravity * 1.5);
	}

	const applyGravity = !onGround;
	if (applyGravity) vy -= gravity * dt * 0.5;

	player.root.pos[0] += vx * dt;
	player.root.pos[1] += vy * dt;
	player.root.pos[2] += vz * dt;

	if (player.root.pos[1] < 0) {
		player.root.pos[1] = 0;
		vy = 0;
	}

	if (applyGravity) vy -= gravity * dt * 0.5;

	if (Math.abs(vx) + Math.abs(vz) > 0.3) {
		const walkSpeed = maxSpeed / 4;
		applyPlayerWalkAnim(player, elapsed * walkSpeed);
	} else {
		applyPlayerRestPose(player);
	}
	player.root.isDirty = true;
}
