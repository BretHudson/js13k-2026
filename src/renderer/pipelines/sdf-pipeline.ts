import type { Renderer } from '~/renderer/renderer';
import type { SceneNode } from '~/scene/scene-node';
import type { Mat4 } from '~/util/mat4';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';

const shaderFilename = 'sdf.wgsl';

export class SDFPipeline extends Pipeline {
	uniformBuffer!: GPUBuffer;

	async init(_renderer: Renderer): Promise<this> {
		this.pipeline = await this.buildPipeline();

		this.initHMR();

		return this;
	}

	initHMR(): void {
		import.meta.hot?.on('shader-update', (data: { file: string }) => {
			if (data.file.endsWith(`shaders/${shaderFilename}`)) {
				void this.buildPipeline().then((pipeline) => {
					this.pipeline = pipeline;
				});
			}
		});
	}

	pipeline!: GPURenderPipeline;

	async _buildPipeline() {
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

		return await this.device.createRenderPipelineAsync({
			layout: 'auto',
			vertex: { module },
			fragment: {
				module,
				targets: [
					{
						format: this.presentationFormat,
						blend: {
							color: {
								srcFactor: 'src-alpha',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add',
							},
							alpha: {
								srcFactor: 'one',
								dstFactor: 'one-minus-src-alpha',
								operation: 'add',
							},
						},
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'none',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});
	}

	async buildPipeline() {
		try {
			return this._buildPipeline();
		} catch (e) {
			console.error('failed to compile pipeline');

			if (!this.pipeline) throw e;

			return this.pipeline;
		}
	}

	render(
		vpMatrix: Mat4,
		textureView: GPUTextureView,
		depthTextureView: GPUTextureView,
		sceneRoot: SceneNode,
	) {
		const { device } = this;

		const commandEncoder = device.createCommandEncoder();

		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
					loadOp: 'load',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: depthTextureView,
				depthClearValue: 1,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
		});

		renderPass.setPipeline(this.pipeline);
		renderPass.draw(3);
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
