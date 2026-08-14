export const fetchShader = async (shaderSrc: string): Promise<string> => {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- safety check
	if (shaderSrc === undefined) {
		console.trace();
		throw new Error('wtf');
	}
	const path = `./shaders/${shaderSrc}`;
	const url = new URL(path, window.location.href);
	return fetch(url.href).then((res) => res.text());
};
