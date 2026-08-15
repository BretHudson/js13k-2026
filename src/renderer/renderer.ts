import type { Camera } from '~/renderer/camera';
import type { SceneNode } from '~/scene/scene-node';
import { MainPipeline } from './pipelines/main-pipeline';
import type { Pipeline } from './pipelines/pipeline';
import { SDFPipeline } from './pipelines/sdf-pipeline';

type PipelineConstructor<T extends Pipeline> = new (
	device: GPUDevice,
	presentationFormat: GPUTextureFormat,
) => T;

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
	sdfPipeline!: SDFPipeline;

	async initPipeline<T extends Pipeline>(
		PipelineClass: PipelineConstructor<T>,
	): Promise<T> {
		return await new PipelineClass(
			this.device,
			this.presentationFormat,
		).init(this);
	}

	async init() {
		this.mainPipeline = await this.initPipeline(MainPipeline);
		this.sdfPipeline = await this.initPipeline(SDFPipeline);

		if (import.meta.hot) {
			this.initHMR();
		}
	}

	initHMR(): void {
		if (import.meta.hot) {
			import.meta.hot.accept('./pipelines/main-pipeline', (mod) => {
				if (mod) {
					void this.initPipeline(
						mod.MainPipeline as typeof MainPipeline,
					).then((p) => (this.mainPipeline = p));
				}
			});
			import.meta.hot.accept('./pipelines/sdf-pipeline', (mod) => {
				if (mod) {
					void this.initPipeline(
						mod.SDFPipeline as typeof SDFPipeline,
					).then((p) => (this.sdfPipeline = p));
				}
			});
		}
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

	renderer.sdfPipeline.render(
		camera.viewProjMatrix,
		canvasTextureView,
		depthTextureView,
		sceneRoot,
		elapsed,
	);
}

let elapsed = 0;
export function updateTime(dt: number) {
	elapsed += dt;
}
