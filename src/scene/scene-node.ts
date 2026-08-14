import type { Mat4, Vec3 } from '~/util/mat4';

export interface SceneNode {
	pos: Vec3;
	rot: Vec3;
	scale: Vec3;

	localMatrix: Mat4;
	worldMatrix: Mat4;

	children: SceneNode[];
	parent?: SceneNode;

	isDirty: boolean;
}
