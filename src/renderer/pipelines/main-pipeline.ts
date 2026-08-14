import type { Renderer } from '~/renderer/renderer';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';

const shaderFilename = 'test.wgsl';

export class MainPipeline extends Pipeline {
	async init(_renderer: Renderer): Promise<void> {
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

	pipeline!: GPURenderPipeline;

	async buildPipeline() {
		try {
			const shaderSrc = await fetchShader(shaderFilename);

			this.device.pushErrorScope('validation');
			const module = this.device.createShaderModule({
				label: 'shader module',
				code: shaderSrc,
			});
			const error = await this.device.popErrorScope();

			if (error) {
				const info = await module.getCompilationInfo();
				for (const msg of info.messages) {
					console.warn(
						`[WGSL ${msg.type}] ${msg.message} at line ${msg.lineNum}:${msg.linePos}`,
					);
				}
				throw new Error(`Shader compilation failed: ${error.message}`);
			}

			const format = this.presentationFormat;
			const pipeline = await this.device.createRenderPipelineAsync({
				layout: 'auto',
				vertex: { module },
				fragment: { module, targets: [{ format }] },
				primitive: { topology: 'triangle-list' },
			});

			return { pipeline };
		} catch (e) {
			console.error('failed to compile pipeline');

			if (!this.pipeline) throw e;

			return { pipeline: this.pipeline };
		}
	}

	render(textureView: GPUTextureView) {
		const { device } = this;

		const commandEncoder = device.createCommandEncoder();

		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		});

		renderPass.setPipeline(this.pipeline);
		renderPass.draw(3);
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
