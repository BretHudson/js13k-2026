import type { Renderer } from '~/renderer/renderer';
import type { Mat4 } from '~/util/mat4';
import { fetchShader } from '../render-utils';
import { Pipeline } from './pipeline';

const shaderFilename = 'test.wgsl';

// prettier-ignore
const faces = [
	[0, 0, 0, 0,], // +X
	[0, 0, 0, 1,], // -X
	[0, 0, 0, 2,], // +Y
	[0, 0, 0, 3,], // -Y
	[0, 0, 0, 4,], // +Z
	[0, 0, 0, 5,], // -Z
] as const;

const faceBufferData = new ArrayBuffer(faces.length * 16);
const floatView = new Float32Array(faceBufferData);
const uintView = new Uint32Array(faceBufferData);

faces.forEach(([x, y, z, face], i) => {
	const offset = i * 4;
	floatView[offset + 0] = x;
	floatView[offset + 1] = y;
	floatView[offset + 2] = z;
	uintView[offset + 3] = face; // Written as a true integer
});

export class MainPipeline extends Pipeline {
	uniformBuffer!: GPUBuffer;
	faceBuffer!: GPUBuffer;

	async init(_renderer: Renderer): Promise<void> {
		this.uniformBuffer = this.device.createBuffer({
			size: 64, // 4x4 matrix
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.faceBuffer = this.device.createBuffer({
			size: faceBufferData.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(this.faceBuffer, 0, faceBufferData);

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
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});

		const bindGroup = this.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: this.uniformBuffer } },
				{ binding: 1, resource: { buffer: this.faceBuffer } },
			],
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

	render(
		mvpMatrix: Mat4,
		textureView: GPUTextureView,
		depthTextureView: GPUTextureView,
	) {
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
			depthStencilAttachment: {
				view: depthTextureView,
				depthClearValue: 1,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
		});

		const faceCount = faces.length;

		renderPass.setPipeline(this.pipeline);
		renderPass.setBindGroup(0, this.bindGroup);
		renderPass.draw(6, faceCount, 0, 0);
		renderPass.end();

		device.queue.submit([commandEncoder.finish()]);
	}
}
