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

	render() {
		const { context } = this;

		const canvasTexture = context.getCurrentTexture();
		const canvasTextureView = canvasTexture.createView();
		this.mainPipeline;

		this.mainPipeline.render(canvasTextureView);
	}
}
