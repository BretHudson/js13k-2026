struct Uniforms {
    invVpMatrix: mat4x4f,
    time: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.uv = vec2f(x * 2.0 - 1.0, 1.0 - y * 2.0);
    out.position = vec4f(out.uv.x, out.uv.y, 0.0, 1.0);
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
const MAX_DIST: f32 = 20.0;
const MAX_STEPS: i32 = 64; // Scaled down for game performance

fn rayMarch(ro: vec3f, rd: vec3f) -> f32 {
    var t = 0.0;
    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * t;
        let d = map(p);
        t += d;
        if d < MIN_DIST || t > MAX_DIST {
            break;
        }
    }
    return t;
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
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    let nearClip = uniforms.invVpMatrix * vec4f(uv.x, uv.y, 0.0, 1.0);
    let nearWorld = nearClip.xyz / nearClip.w;

    let farClip = uniforms.invVpMatrix * vec4f(uv.x, uv.y, 1.0, 1.0);
    let farWorld = farClip.xyz / farClip.w;

    let ro = nearWorld;
    let rd = normalize(farWorld - nearWorld);

    let t = rayMarch(ro, rd);
    if t > MAX_DIST { return vec4f(0.0); }

    let p = ro + rd * t;
    let n = getNormal(p);

    let lightDir = normalize(vec3f(1.0, 2.0, -1.5));
    let viewDir = normalize(ro - p);
    let halfVec = normalize(lightDir + viewDir);

    let diff = max(dot(n, lightDir), 0.0);
    let spec = pow(max(dot(n, halfVec), 0.0), 32.0);
    let ambient = 0.15;

    let baseColor = vec3f(1.0, 0.35, 0.65);
    let finalColor = baseColor * (diff + ambient) + vec3f(1.0) * spec * 0.4;

    return vec4f(finalColor, 1.0);
}
