import type { Camera } from '~/renderer/camera';
import type { SceneNode } from '~/scene/scene-node';
import { BlitPipeline } from './pipelines/blit-pipeline';
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

	sceneTexture!: GPUTexture;
	depthTexture!: GPUTexture;

	mainPipeline!: MainPipeline;
	blitPipeline!: BlitPipeline;
	sdfPipeline!: SDFPipeline;

	blitBindGroup!: GPUBindGroup;

	async initPipeline<T extends Pipeline>(
		PipelineClass: PipelineConstructor<T>,
	): Promise<T> {
		return await new PipelineClass(
			this.device,
			this.presentationFormat,
		).init(this);
	}

	async init() {
		this.onCanvasSizeUpdate();

		this.mainPipeline = await this.initPipeline(MainPipeline);
		this.blitPipeline = await this.initPipeline(BlitPipeline);
		this.sdfPipeline = await this.initPipeline(SDFPipeline);

		this.blitBindGroup = this.blitPipeline.createBindGroup(
			this.sceneTexture.createView(),
		);

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
			import.meta.hot.accept('./pipelines/blit-pipeline', (mod) => {
				if (mod) {
					void this.initPipeline(
						mod.BlitPipeline as typeof BlitPipeline,
					).then((p) => (this.blitPipeline = p));
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

	onCanvasSizeUpdate(): void {
		const { width, height } = this.context.canvas;
		const aspect = width / height;

		let w = 320,
			h = 240;
		if (aspect > w / h) {
			w = Math.round(h * aspect);
		} else {
			h = Math.round(w / aspect);
		}

		// update scene texture
		if (this.sceneTexture) this.sceneTexture.destroy();

		this.sceneTexture = this.device.createTexture({
			size: [w, h],
			format: this.presentationFormat,
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING,
		});

		this.blitBindGroup = this.blitPipeline?.createBindGroup(
			this.sceneTexture.createView(),
		);

		// update depth texture
		if (this.depthTexture) this.depthTexture.destroy();

		this.depthTexture = this.device.createTexture({
			size: [w, h],
			format: 'depth24plus',
			usage:
				GPUTextureUsage.RENDER_ATTACHMENT |
				GPUTextureUsage.TEXTURE_BINDING,
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
		renderer.sceneTexture.createView(),
		depthTextureView,
		sceneRoot,
	);

	renderer.blitPipeline.render(renderer.blitBindGroup, canvasTextureView);

	renderer.sdfPipeline.render(
		camera.viewProjMatrix,
		canvasTextureView,
		depthTextureView,
		sceneRoot,
		elapsed,
		renderer.context.canvas,
		camera,
	);
}

let elapsed = 0;
export function updateTime(dt: number) {
	elapsed += dt;
}
