import type { Renderer } from '~/renderer/renderer';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';

const shaderFilename = 'blit.wgsl';

export class BlitPipeline extends Pipeline {
	pipeline!: GPURenderPipeline;
	sampler!: GPUSampler;

	async init(_renderer: Renderer): Promise<this> {
		// Nearest-neighbor filtering preserves retro pixelation
		this.sampler = this.device.createSampler({
			minFilter: 'nearest',
			magFilter: 'nearest',
		});

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

	async _buildPipeline(): Promise<GPURenderPipeline> {
		const shaderSrc = await fetchShader(shaderFilename);

		const module = this.device.createShaderModule({
			label: 'Blit Shader Module',
			code: shaderSrc,
		});

		return await this.device.createRenderPipelineAsync({
			layout: 'auto',
			vertex: { module },
			fragment: {
				module,
				targets: [{ format: this.presentationFormat }],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'none',
			},
			// Blit overwrites the destination canvas directly; no depth testing needed
			depthStencil: undefined,
		});
	}

	async buildPipeline(): Promise<GPURenderPipeline> {
		try {
			return await this._buildPipeline();
		} catch (e) {
			console.error('Failed to compile Blit pipeline', e);
			if (!this.pipeline) throw e;
			return this.pipeline;
		}
	}

	createBindGroup(sourceTextureView: GPUTextureView): GPUBindGroup {
		return this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: this.sampler },
				{ binding: 1, resource: sourceTextureView },
			],
		});
	}

	render(bindGroup: GPUBindGroup, targetTextureView: GPUTextureView) {
		const commandEncoder = this.device.createCommandEncoder();

		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: targetTextureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		});

		renderPass.setPipeline(this.pipeline);
		renderPass.setBindGroup(0, bindGroup);
		renderPass.draw(3);
		renderPass.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}
}
