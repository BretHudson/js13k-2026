// import { zzfx } from './third-party/zzfx';

import { GameLoop, init, initKeys, keyPressed, Sprite } from 'kontra';
import { Renderer } from './renderer/renderer';

async function setupApp() {
	const canvas = document.getElementById('c') as HTMLCanvasElement;

	initKeys();

	if (!navigator.gpu) throw new Error('WebGPU not supported');
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter?.requestDevice();
	if (!device) throw new Error('Failed to create WebGPU device');

	const renderer = new Renderer(canvas, device);
	const { context } = renderer;

	await renderer.init();

	const loop = GameLoop({
		clearCanvas: false,

		update(dt) {},

		render() {
			const canvasTexture = context.getCurrentTexture();
			const canvasTextureView = canvasTexture.createView();

			const commandEncoder = device.createCommandEncoder();

			const renderPass = commandEncoder.beginRenderPass({
				colorAttachments: [
					{
						view: canvasTextureView,
						clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
						loadOp: 'clear',
						storeOp: 'store',
					},
				],
			});

			renderPass.setPipeline(renderer.pipeline);
			renderPass.draw(3);
			renderPass.end();

			device.queue.submit([commandEncoder.finish()]);
		},
	});

	loop.start();
}

void setupApp();
