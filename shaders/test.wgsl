@group(0) @binding(0) var<uniform> mvp: mat4x4f;

struct VertexInput {
    @location(0) position: vec3f,
};

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 3>(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
    );
    return mvp * vec4f(pos[idx], 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.5, 1.0, 1.0);
}
