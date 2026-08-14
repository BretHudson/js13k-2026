import * as mat4 from '../util/mat4';
import type { Vec3 } from '~/util/mat4';

export class Camera {
	eye: Vec3 = [0, 5, 10];
	target: Vec3 = [0, 0, 0];
	up: Vec3 = [0, 1, 0];

	distance = 10;
	yaw = 0;
	pitch = 0.3;

	fovY = Math.PI / 4;

	viewMatrix = mat4.create();
	projMatrix = mat4.create();
	viewProjMatrix = mat4.create();

	update(aspect: number) {
		const maxPitch = Math.PI / 2 - 0.01;
		this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

		const cosPitch = Math.cos(this.pitch);
		this.eye[0] =
			this.target[0] + this.distance * Math.sin(this.yaw) * cosPitch;
		this.eye[1] = this.target[1] + this.distance * Math.sin(this.pitch);
		this.eye[2] =
			this.target[2] + this.distance * Math.cos(this.yaw) * cosPitch;

		mat4.lookAt(this.viewMatrix, this.eye, this.target, this.up);
		mat4.perspective(this.projMatrix, this.fovY, aspect, 0.1, 100);
		mat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);
	}
}
