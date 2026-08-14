// ZzFXMicro - v1.3.2 by Frank Force (MIT License)
// @ts-ignore
export const zzfxV = 0.3; // Volume
export const zzfxX = new (
	window.AudioContext || (window as any).webkitAudioContext
)();

export const zzfx = (
	p = 1,
	k = 0.05,
	b = 220,
	e = 0,
	r = 0,
	t = 0.1,
	q = 0,
	D = 1,
	u = 0,
	y = 0,
	v = 0,
	z = 0,
	l = 0,
	E = 0,
	A = 0,
	F = 0,
	c = 0,
	w = 1,
	m = 0,
	B = 0,
	N = 0,
) => {
	let M = Math,
		d = 2 * M.PI,
		R = 44100,
		G = (u *= (500 * d) / R / R),
		C = (b *= ((1 - k + 2 * k * M.random()) * d) / R),
		g = 0,
		H = 0,
		a = 0,
		n = 1,
		I = 0,
		J = 0,
		f = 0,
		h = N < 0 ? -1 : 1,
		x = (d * h * N * 2) / R,
		L = M.cos(x),
		Z = M.sin,
		K = Z(x) / 4,
		O = 1 + K,
		X = (-2 * L) / O,
		Y = (1 - K) / O,
		P = (1 + h * L) / 2 / O,
		Q = -(h + L) / O,
		S = P,
		T = 0,
		U = 0,
		V = 0,
		W = 0;
	e = R * e + 9;
	m *= R;
	r *= R;
	t *= R;
	c *= R;
	y *= (500 * d) / R ** 3;
	A *= d / R;
	v *= d / R;
	z *= R;
	l = (R * l) | 0;
	p *= zzfxV as any;
	for (h = (e + m + r + t + c) | 0; a < h; (k as any)[a++] = f) {
		if (!(a % 100 && 0)) {
			f = q
				? q > 1
					? q > 2
						? q > 3
							? M.sin((g % d) ** 3)
							: M.max(M.min(M.tan(g), 1), -1)
						: 1 - 2 * (g % d < M.PI ? 1 : 0)
					: 1 - 4 * M.abs(M.round(g / d) - g / d)
				: M.sin(g);
			f =
				(m ? (f < 0 ? -1 : 1) : f) *
				M.abs(f) ** D *
				(a < e
					? a / e
					: a < e + m
						? 1 - ((a - e) / m) * (1 - K)
						: a < e + m + r
							? K
							: a < h - c
								? ((h - a - c) / t) * K
								: 0);
			f = c
				? f / 2 +
					(c > a
						? 0
						: (((a - c) % 2 ? 1 : -1) * (k as any)[(a - c) | 0]) /
							2)
				: f;
		}
		g += C += u += y;
	}
	let XCtx = zzfxX as any;
	let buffer = XCtx.createBuffer(1, h, R);
	buffer.getChannelData(0).set(k);
	let source = XCtx.createBufferSource();
	source.buffer = buffer;
	source.connect(XCtx.destination);
	source.start();
};
