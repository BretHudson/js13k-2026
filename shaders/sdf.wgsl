struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.uv = vec2f(x * 2.0 - 1.0, 1.0 - y * 2.0);
    out.position = vec4f(out.uv.x, out.uv.y, 0.0, 1.0);
    return out;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let radius = 0.5;

    let d = length(uv) - radius;
    let alpha = smoothstep(0.0, -fwidth(d), d);
    let circleColor = vec3f(1.0, 0.2, 0.5);
    return vec4f(circleColor, alpha);
}
