import type { Renderer } from '~/renderer/renderer';
import type { Mat4 } from '~/util/mat4';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';

const shaderFilename = 'test.wgsl';

export class MainPipeline extends Pipeline {
	uniformBuffer!: GPUBuffer;

	async init(_renderer: Renderer): Promise<void> {
		this.uniformBuffer = this.device.createBuffer({
			size: 64, // 4x4 matrix
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const { pipeline, bindGroup } = await this.buildPipeline();

		this.pipeline = pipeline;
		this.bindGroup = bindGroup;

		this.initHMR();
	}

	initHMR(): void {
		import.meta.hot?.on('shader-update', (data: { file: string }) => {
			if (data.file.endsWith(`shaders/${shaderFilename}`)) {
				void this.buildPipeline().then(({ pipeline, bindGroup }) => {
					this.pipeline = pipeline;
					this.bindGroup = bindGroup;
				});
			}
		});
	}

	pipeline!: GPURenderPipeline;
	bindGroup!: GPUBindGroup;

	async #buildPipeline() {
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

		const bindGroup = this.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
		});

		return { pipeline, bindGroup };
	}

	async buildPipeline() {
		try {
			return this.#buildPipeline();
		} catch (e) {
			console.error('failed to compile pipeline');

			if (!this.pipeline) throw e;

			return { pipeline: this.pipeline, bindGroup: this.bindGroup };
		}
	}

	render(mvpMatrix: Mat4, textureView: GPUTextureView) {
		const { device } = this;

		device.queue.writeBuffer(this.uniformBuffer, 0, mvpMatrix);

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
		renderPass.setBindGroup(0, this.bindGroup);
		renderPass.draw(3);
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
