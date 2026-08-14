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
