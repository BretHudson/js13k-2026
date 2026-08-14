import type { Camera } from '~/renderer/camera';
import type { SceneNode } from '~/scene/scene-node';
import { MainPipeline } from './pipelines/main-pipeline';

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

	depthTexture!: GPUTexture;
	onCanvasSizeUpdate(): void {
		// update depth texture
		if (this.depthTexture) this.depthTexture.destroy();

		const { width, height } = this.context.canvas;

		this.depthTexture = this.device.createTexture({
			size: [width, height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
	}

	render(sceneRoot: SceneNode, camera: Camera) {
		const { context } = this;

		const canvasTexture = context.getCurrentTexture();
		const canvasTextureView = canvasTexture.createView();
		this.mainPipeline;

		const depthTextureView = this.depthTexture.createView();

		this.mainPipeline.render(
			camera.viewProjMatrix,
			canvasTextureView,
			depthTextureView,
			sceneRoot,
		);
	}
}

export function render(
	renderer: Renderer,
	sceneRoot: SceneNode,
	camera: Camera,
) {
	const { context } = renderer;

	const canvasTexture = context.getCurrentTexture();
	const canvasTextureView = canvasTexture.createView();
	renderer.mainPipeline;

	const depthTextureView = renderer.depthTexture.createView();

	renderer.mainPipeline.render(
		camera.viewProjMatrix,
		canvasTextureView,
		depthTextureView,
		sceneRoot,
	);
}
