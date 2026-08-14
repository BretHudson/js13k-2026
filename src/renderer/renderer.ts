import { fetchShader } from './render-utils';

const shaderFilename = 'test.wgsl';

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

	pipeline!: GPURenderPipeline;

	async buildPipeline() {
		const shaderSrc = await fetchShader(shaderFilename);

		const module = this.device.createShaderModule({
			label: 'shader module',
			code: shaderSrc,
		});

		const format = this.presentationFormat;
		const pipeline = this.device.createRenderPipeline({
			layout: 'auto',
			vertex: { module },
			fragment: { module, targets: [{ format }] },
			primitive: { topology: 'triangle-list' },
		});

		return { pipeline };
	}

	async init() {
		const { pipeline } = await this.buildPipeline();

		this.pipeline = pipeline;

		this.initHMR();
	}

	initHMR(): void {
		import.meta.hot?.on('shader-update', (data: { file: string }) => {
			if (data.file.endsWith(`shaders/${shaderFilename}`)) {
				void this.buildPipeline().then(({ pipeline }) => {
					this.pipeline = pipeline;
				});
			}
		});
	}
}
