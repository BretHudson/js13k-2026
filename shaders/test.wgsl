struct FaceData {
    pos: vec3f,
    face: u32,
};

@group(0) @binding(0) var<uniform> vpMatrix: mat4x4f;
@group(0) @binding(1) var<storage, read> models: array<mat4x4f>;
@group(0) @binding(2) var<storage, read> faces: array<FaceData>;

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) color: vec3f,
    // @interpolate(linear) for affine texture mapping
    @location(1) @interpolate(linear) uv: vec2f,
};

// grabbed from the book of shaders
fn random(_st: vec2f) -> f32 {
    return fract(sin(dot(_st.xy,
        vec2f(12.9898, 78.233))) *
        43758.5453123);
}

const BASES = array<mat2x3f, 6>(
	// +X: (1, y, 1 - x)
    mat2x3f(vec3f(0.0, 0.0, -1.0), vec3f(0.0, 1.0, 0.0)),
	// -X: (0, y, x)
    mat2x3f(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0)),
	// +Y: (x, 1, 1 - y)
    mat2x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, -1.0)),
	// -Y: (x, 0, y)
    mat2x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0)),
	// +Z: (x, y, 1)
    mat2x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0)),
	// -Z: (1 - x, y, 0)
    mat2x3f(vec3f(-1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0)),
);

const ORIGINS = array<vec3f, 6>(
    vec3f(0.5, -0.5, 0.5), // +X
    vec3f(-0.5, -0.5, -0.5), // -X
    vec3f(-0.5, 0.5, 0.5), // +Y
    vec3f(-0.5, -0.5, -0.5), // -Y
    vec3f(-0.5, -0.5, 0.5), // +Z
    vec3f(0.5, -0.5, -0.5), // -Z
);

const COLORS = array<vec3f, 6>(
    vec3f(0.9, 0.4, 0.4),
    vec3f(0.8, 0.3, 0.3),
    vec3f(0.5, 0.9, 0.5),
    vec3f(0.3, 0.6, 0.3),
    vec3f(0.4, 0.6, 0.9),
    vec3f(0.3, 0.4, 0.7),
);

@vertex
fn vs(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
    let quad_index = array<u32, 6>(0u, 1u, 2u, 2u, 1u, 3u)[vertex_index];

    let model = models[instance_index / 6u];

    let uv = vec2f(f32(quad_index & 1u), f32((quad_index >> 1u) & 1u));

    let f = faces[instance_index % 6u];
    var offset = ORIGINS[f.face] + BASES[f.face] * uv;
    var normalColor = COLORS[f.face];

    let resolution = vec2f(320, 240);
    let halfRes = resolution * .5;

    let worldPos = f.pos + offset;
    let clipPos = vpMatrix * model * vec4f(worldPos, 1.0);

    let ndc = clipPos.xy / clipPos.w;
    let snappedNdc = round(ndc * halfRes) / halfRes;

    var out: VertexOutput;
    out.pos = vec4f(snappedNdc * clipPos.w, clipPos.zw);
    out.uv = uv;
    out.color = vec3f(1, 1, 0);

    return out;
}

const BAYER_4X4 = array<f32, 16>(
    0.0 / 16.0, 8.0 / 16.0, 2.0 / 16.0, 10.0 / 16.0,
    12.0 / 16.0, 4.0 / 16.0, 14.0 / 16.0, 6.0 / 16.0,
    3.0 / 16.0, 11.0 / 16.0, 1.0 / 16.0, 9.0 / 16.0,
    15.0 / 16.0, 7.0 / 16.0, 13.0 / 16.0, 5.0 / 16.0,
);

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
    let coord = vec2u(in.pos.xy) % 4u;
    let dither = BAYER_4X4[coord.y * 4u + coord.x];

    let color = vec3f(
        in.color.r * in.uv.x,
        in.color.g * in.uv.y,
        in.color.b,
    );

    let dithered = color * 31.0 + dither;
    let quantized = clamp(floor(dithered) / 31.0, vec3f(0), vec3f(1));

    // let quantized = round(in.color * 31.) / 31.;
    return vec4f(quantized, 1.0);
}
