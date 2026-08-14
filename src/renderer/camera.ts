import * as mat4 from '../util/mat4';
import type { Vec3 } from '~/util/mat4';

export class Camera {
	eye: Vec3 = [0, 5, 10];
	target: Vec3 = [0, 0, 0];
	up: Vec3 = [0, 1, 0];

	forward: Vec3 = [0, 0, -1];

	distance = 10;
	yaw = 0;
	pitch = 0.3;

	fovY = Math.PI / 4;

	viewMatrix = mat4.create();
	projMatrix = mat4.create();
	viewProjMatrix = mat4.create();

	follow(
		target: [number, number, number],
		playerYaw: number,
		speed: number,
		dt: number,
		posSmoothness: number,
		yawSmoothness: number,
	) {
		const t = 1 - Math.exp(-posSmoothness * dt);
		this.target[0] += (target[0] - this.target[0]) * t;
		this.target[1] += (target[1] - this.target[1]) * t;
		this.target[2] += (target[2] - this.target[2]) * t;

		if (speed > 0.05) {
			const desiredYaw = playerYaw + Math.PI;

			let diff = (desiredYaw - this.yaw) % (Math.PI * 2);
			diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

			const tYaw = 1 - Math.exp(-yawSmoothness * dt);
			this.yaw += diff * tYaw;
		}
	}

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

		for (let i = 0; i < 3; ++i) {
			this.forward[i] = this.target[i] - this.eye[i];
		}
	}
}
