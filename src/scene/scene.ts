import type { SceneNode } from '~/scene/scene-node';
import * as mat4 from '../util/mat4';
import type { Mat4 } from '~/util/mat4';

export function createNode(x = 0, y = 0, z = 0): SceneNode {
	return {
		pos: [x, y, z],
		rot: [0, 0, 0],
		scale: [1, 1, 1],

		localMatrix: mat4.create(),
		worldMatrix: mat4.create(),

		children: [],
		isDirty: true,

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

export function createPlayer() {
	const playerRoot = createNode();
	playerRoot.scale[0] = playerRoot.scale[1] = playerRoot.scale[2] = 2;
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
		node.parent = parent;
		parent.children.push(node);
		return node;
	};

	addPart(0, 0.45, 0, 0.45, 0.35, 0.6); // Torso
	addPart(0, 0.65, 0.2, 0.2, 0.35, 0.2); // Neck

	addPart(0, 0.85, 0.35, 0.3, 0.3, 0.4); // Head
	const horn = addPart(0, 1.1, 0.5, 0.06, 0.55, 0.06);
	horn.rot[0] = Math.PI / 5;

	addPart(-0.18, 0.22, 0.2, 0.12, 0.45, 0.12); // Front-Left Leg
	addPart(0.18, 0.22, 0.2, 0.12, 0.45, 0.12); // Front-Right Leg
	addPart(-0.2, 0.22, -0.2, 0.14, 0.45, 0.14); // Back-Left Leg
	addPart(0.2, 0.22, -0.2, 0.14, 0.45, 0.14); // Back-Right Leg

	const tail = addPart(0, 0.35, -0.32, 0.1, 0.45, 0.12);
	tail.rot[0] = Math.PI / 12;

	return playerRoot;
}

export function createWorld(sceneRoot: SceneNode) {
	{
		const floor = createNode(0, -50.5);
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
