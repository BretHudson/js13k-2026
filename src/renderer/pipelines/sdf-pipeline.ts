import type { Renderer } from '~/renderer/renderer';
import type { SceneNode } from '~/scene/scene-node';
import type { Mat4 } from '~/util/mat4';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';
import * as mat4 from '../../util/mat4';

const shaderFilename = 'sdf.wgsl';

const invVpMatrix = mat4.create();

export class SDFPipeline extends Pipeline {
	uniformBuffer!: GPUBuffer;

	uniformData = new Float32Array(20);

	async init(renderer: Renderer): Promise<this> {
		this.depthTextureView = renderer.depthTexture.createView();

		this.uniformBuffer = this.device.createBuffer({
			label: 'SDF uniforms buffer',
			size: this.uniformData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const { pipeline, bindGroup } = await this.buildPipeline();
		this.pipeline = pipeline;
		this.bindGroup = bindGroup;

		this.initHMR();

		return this;
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

		const pipeline = await this.device.createRenderPipelineAsync({
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
			// depthStencil: {
			// 	depthWriteEnabled: true,
			// 	depthCompare: 'less',
			// 	format: 'depth24plus',
			// },
		});

		console.log(this.depthTextureView);

		const bindGroup = this.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.uniformBuffer } },
				{ binding: 1, resource: this.depthTextureView },
			],
		});

		return { pipeline, bindGroup };
	}

	depthTextureView!: GPUTextureView;

	async buildPipeline() {
		try {
			return this._buildPipeline();
		} catch (e) {
			console.error('failed to compile pipeline');

			if (!this.pipeline) throw e;

			return { pipeline: this.pipeline, bindGroup: this.bindGroup };
		}
	}

	render(
		vpMatrix: Mat4,
		textureView: GPUTextureView,
		depthTextureView: GPUTextureView,
		sceneRoot: SceneNode,
		time: number,
	) {
		const { device } = this;

		const commandEncoder = device.createCommandEncoder();

		if (depthTextureView !== this.depthTextureView) {
			this.depthTextureView = depthTextureView;
			this.bindGroup = this.device.createBindGroup({
				layout: this.pipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: this.uniformBuffer } },
					{ binding: 1, resource: this.depthTextureView },
				],
			});
		}

		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
					loadOp: 'load',
					storeOp: 'store',
				},
			],
			// depthStencilAttachment: {
			// 	view: depthTextureView,
			// 	depthClearValue: 1,
			// 	depthLoadOp: 'clear',
			// 	depthStoreOp: 'store',
			// },
		});

		mat4.invert(invVpMatrix, vpMatrix);

		this.uniformData.set(invVpMatrix, 0);
		this.uniformData[16] = time;

		device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			this.uniformData.buffer,
			this.uniformData.byteOffset,
			this.uniformData.byteLength,
		);

		renderPass.setPipeline(this.pipeline);
		renderPass.setBindGroup(0, this.bindGroup);
		renderPass.draw(3);
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
