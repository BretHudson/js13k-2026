struct Uniforms {
    invVpMatrix: mat4x4f,
    time: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv_ndc: vec2f,
    @location(1) uv_norm: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var depthTexture: texture_depth_2d;

struct FragmentOutput {
    @location(0) color: vec4f,
    // @builtin(frag_depth) depth: f32,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.uv_ndc = vec2f(x * 2.0 - 1.0, 1.0 - y * 2.0);
    out.uv_norm = vec2f(x, y);
    out.position = vec4f(out.uv_ndc, 0.0, 1.0);

    return out;
}

// grabbed this from my shadertoy
// https://www.shadertoy.com/view/XXtGRr

// primitives
fn rot2D(p: vec2f, a: f32) -> vec2f {
    let s = sin(a);
    let c = cos(a);
    return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// distance map

fn map(p: vec3f) -> f32 {
    var q = p;
    q = vec3f(rot2D(q.xy, uniforms.time), q.z);

    let box = sdBox(q, vec3f(0.6));
    let sphere = sdSphere(p - vec3f(3. * sin(uniforms.time), 0.2, 0.0), 0.5);

    return smin(box, sphere, 0.3);
}

fn getNormal(p: vec3f) -> vec3f {
    let h = 0.001;
    let k = vec2f(1.0, -1.0);
    return normalize(
        k.xyy * map(p + k.xyy * h) +
        k.yxy * map(p + k.yxy * h) +
        k.yyx * map(p + k.yyx * h) +
        k.xxx * map(p + k.xxx * h)
    );
}

// raymarch
const MIN_DIST: f32 = 0.001;
const MAX_DIST: f32 = 1000.0;
const MAX_STEPS: i32 = 64;

fn rayMarch(ro: vec3f, rd: vec3f) -> f32 {
    var t = 0.0;
    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * t;
        let d = map(p);
        t += d;
        if d < MIN_DIST || t > MAX_DIST { break; }
    }
    return t;
}

fn getSceneDepthDistance(uvNorm: vec2f, ro: vec3f, rd: vec3f, invVP: mat4x4f) -> f32 {
    let depthDims = vec2f(textureDimensions(depthTexture));

    let texelCoord = vec2u(clamp(uvNorm * depthDims, vec2f(0), depthDims - 1.0));

    let rawDepth = textureLoad(depthTexture, texelCoord, 0);
    if rawDepth >= 1.0 { return MAX_DIST; }

    let ndc = vec2f(uvNorm.x * 2.0 - 1.0, 1.0 - uvNorm.y * 2.0);
    let sceneClip = invVP * vec4f(ndc, rawDepth, 1.0);
    let sceneWorld = sceneClip.xyz / sceneClip.w;

    return length(sceneWorld - ro);
}

// @fragment
// fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
//     let radius = 0.5;

//     let d = length(uv) - radius;
//     let alpha = smoothstep(0.0, -fwidth(d), d);
//     // let circleColor = vec3f(1.0, 0.2, 0.5);
//     let circleColor = vec3f(1.0, 0.35, 0.65);
//     return vec4f(circleColor, alpha);
// }

@fragment
fn fs_main(in: VertexOutput) -> FragmentOutput {
    let nearClip = uniforms.invVpMatrix * vec4f(in.uv_ndc.x, in.uv_ndc.y, 0.0, 1.0);
    let nearWorld = nearClip.xyz / nearClip.w;

    let farClip = uniforms.invVpMatrix * vec4f(in.uv_ndc.x, in.uv_ndc.y, 1.0, 1.0);
    let farWorld = farClip.xyz / farClip.w;

    let ro = nearWorld;
    let rd = normalize(farWorld - nearWorld);

    let maxSceneT = getSceneDepthDistance(in.uv_norm, ro, rd, uniforms.invVpMatrix);

    let t = rayMarch(ro, rd);
    if t >= maxSceneT || t > MAX_DIST { discard; }

    let p = ro + rd * t;
    let n = getNormal(p);

    let lightDir = normalize(vec3f(0.5, 1.0, .4));
    let viewDir = normalize(ro - p);
    let halfVec = normalize(lightDir + viewDir);

    // TODO(bret): update this to more match the mesh shader
    let diff = max(dot(n, lightDir), 0.0);
    let spec = pow(max(dot(n, halfVec), 0.0), 32.0);
    let ambient = 0.15;

    let baseColor = vec3f(1.0, 0.35, 0.65);
    let finalColor = baseColor * (diff + ambient) + vec3f(1.0) * spec * 0.4;

    let hitDepth = 0.0;

    var out: FragmentOutput;
    out.color = vec4f(finalColor, 1.0);
    // out.depth = hitDepth;

    return out;
}
