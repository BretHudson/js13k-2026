// import { zzfx } from './third-party/zzfx';

import { GameLoop, init, Sprite } from 'kontra';

const { canvas } = init();

const sprite = Sprite({
	x: canvas.width / 2 - 10,
	y: canvas.height / 2 - 20,
	color: 'cyan',
	width: 32,
	height: 32,
	dx: 2,
});

const loop = GameLoop({
	update(dt) {
		sprite.update();
		if (sprite.x > canvas.width) {
			sprite.x = -sprite.width;
		}
	},
	render() {
		sprite.render();
	},
});

loop.start();
