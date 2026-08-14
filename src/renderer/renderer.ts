import { MainPipeline } from './pipelines/main-pipeline';
import * as mat4 from '../util/mat4';

const proj = mat4.create();
const view = mat4.create();
const vp = mat4.create();

let rotY = 0;

export class Renderer {
	device: GPUDevice;
	presentationFormat: GPUTextureFormat;
	context: GPUCanvasContext;

	constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
		this.device = device;

		const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
		if (!context) throw new Error('Failed to create WebGPU context');

		const format = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device, format, alphaMode: 'opaque' });

		this.presentationFormat = format;

		this.context = context;
	}

	mainPipeline!: MainPipeline;

	async init() {
		const mainPipeline = new MainPipeline(
			this.device,
			this.presentationFormat,
		);

		this.mainPipeline = mainPipeline;

		await mainPipeline.init(this);
	}

	update(dt: number, aspect: number) {
		rotY += dt;

		mat4.perspective(proj, 70, aspect, 0, 1000);
		mat4.fromTRS(view, 0, 0, -5, 0, rotY);
		mat4.multiply(vp, proj, view);
	}

	render() {
		const { context } = this;

		const canvasTexture = context.getCurrentTexture();
		const canvasTextureView = canvasTexture.createView();
		this.mainPipeline;

		this.mainPipeline.render(vp, canvasTextureView);
	}
}
