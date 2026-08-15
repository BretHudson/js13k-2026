struct Uniforms {
    invVpMatrix: mat4x4f,
    cameraPos: vec3f,
    time: f32,
    resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var depthTexture: texture_depth_2d;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv_ndc: vec2f,
    @location(1) uv_norm: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
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

fn rotX(p: vec3f, a: f32) -> vec3f {
    return vec3f(p.x, rot2D(p.yz, a));
}

fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdBoxRound(p: vec3f, b: vec3f, roundFactor: f32) -> f32 {
    let maxR = min(b.x, min(b.y, b.z));
    let rad = maxR * clamp(roundFactor, 0.0, 1.0);

    let q = abs(p) - (b - vec3f(rad));
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - rad;
}

fn sdEllipsoid(p: vec3f, r: vec3f) -> f32 {
    let k0 = length(p / r);
    let k1 = length(p / (r * r));
    return k0 * (k0 - 1.0) / k1;
}

fn sdVerticalCapsule(p: vec3f, h: f32, r: f32) -> f32 {
    var q = p;
    q.y -= clamp(p.y, 0.0, h);
    return length(q) - r;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// distance map

const COLORS = array<vec3f, 5>(
    vec3f(1., 0., 1.),
    vec3f(.94, .96, 1.0),
    vec3f(1.0, 0.35, 0.65),
    vec3f(1.0, 0.85, 0.93),
    vec3f(.87, .90, .94),
);

const C_NULL = 0;
const C_WHITE = 1;
const C_PINK = 2;
const C_OFF_WHITE = 3;
const C_SILVER = 4;

fn sdTorso(p: vec3f) -> f32 {
    let q = rotX(p - vec3f(0.0, -0.3, 1.2), -.4);
    return sdEllipsoid(q, vec3f(1.8, 1.8, 2.5));
}

fn sdHead(p: vec3f) -> f32 {
    let mainP = vec3f(0.0, 2.25, 0.0);
    let main = sdEllipsoid(p - mainP, vec3f(1.75, 1.55, 1.60));
    let snoutP = vec3f(0.0, 2.05, -1.35);
    let snout = sdEllipsoid(p - snoutP, vec3f(1.25, .95, 1.05));
    return smin(main, snout, 0.5);
}

fn sdLeg(p: vec3f, position: vec3f) -> f32 {
    let q = rotX(p - position, -.7);
    return sdVerticalCapsule(q, 1.75, 0.6);
}

fn sdLegs(p: vec3f) -> f32 {
    let frontLeft = sdLeg(p, vec3f(-1.25, -1.75, 0.85));
    let frontRight = sdLeg(p, vec3f(1.25, -1.75, 0.85));
    let backLeft = sdLeg(p, vec3f(-1.25, -1.75, -0.85));
    let backRight = sdLeg(p, vec3f(1.25, -1.75, -0.85));

    let front = smin(frontLeft, frontRight, 0.35);
    let back = smin(backLeft, backRight, 0.35);

    return smin(front, back, 0.35);
}

fn sdEar(p: vec3f, position: vec3f, angle: f32) -> f32 {
    let q = p - position;
    let rotated = vec3f(rot2D(q.xy, angle), q.z);
    return sdEllipsoid(rotated, vec3f(0.62, 0.95, 0.55));
}

fn sdEars(p: vec3f) -> f32 {
    let left = sdEar(p, vec3f(-1.15, 3.35, 0.0), -0.20);
    let right = sdEar(p, vec3f(1.15, 3.35, 0.0), 0.20);

    return smin(left, right, 0.35);
}

fn map(p: vec3f) -> f32 {
    return sdSphere(p, 3.0);

    // var q = p;
    // // q -= vec3f(0, 2., 0);
    // let torso = sdTorso(q);
    // let head = sdHead(q);
    // let legs = sdLegs(q);
    // let ears = sdEars(q);

    // var unicorn = torso;
    // unicorn = smin(unicorn, head, 0.65);
    // unicorn = smin(unicorn, legs, 0.45);
    // unicorn = smin(unicorn, ears, 0.35);

    // return unicorn;
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
const MAX_STEPS: i32 = 128;
const MIN_DIST: f32 = 0.001;
const MAX_DIST: f32 = 100.0;

fn rayMarch(ro: vec3f, rd: vec3f, maxT: f32) -> vec4f {
    var t = 0.0;
    var lastMat = 0.0;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * t;
        let d = map(p);
        lastMat = C_WHITE;
        if d < MIN_DIST { break; }

        t += d;
        if t >= maxT || t > MAX_DIST { break; }
    }

    return vec4f(t, lastMat, 0.0, 0.0);
}

const MAX_FUR_STEPS: i32 = 64;
const FUR_DEPTH: f32 = 0.35;
const FUR_STEP: f32 = 0.01;
const FUR_DENSITY: f32 = 2.0;

fn hash3(p: vec3f) -> f32 {
    let q = fract(p * 0.3183099 + vec3f(0.1, 0.2, 0.3));
    return fract(17.0 * q.x * q.y * q.z * (q.x + q.y + q.z));
}

fn noise3D(p: vec3f) -> f32 {
    let i = floor(p);
    let f = fract(p);

    let u = f * f * (3.0 - 2.0 * f);

    let n000 = hash3(i + vec3f(0, 0, 0));
    let n100 = hash3(i + vec3f(1, 0, 0));
    let n010 = hash3(i + vec3f(0, 1, 0));
    let n110 = hash3(i + vec3f(1, 1, 0));
    let n001 = hash3(i + vec3f(0, 0, 1));
    let n101 = hash3(i + vec3f(1, 0, 1));
    let n011 = hash3(i + vec3f(0, 1, 1));
    let n111 = hash3(i + vec3f(1, 1, 1));

    let nx00 = mix(n000, n100, u.x);
    let nx10 = mix(n010, n110, u.x);
    let nx01 = mix(n001, n101, u.x);
    let nx11 = mix(n011, n111, u.x);

    let nxy0 = mix(nx00, nx10, u.y);
    let nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

fn rayMarchFur(ro: vec3f, rd: vec3f, maxT: f32) -> vec4f {
    var t = 0.0;
    var density = 0.0;

    for (var i = 0; i < MAX_FUR_STEPS; i++) {
        if t >= maxT || t >= MAX_DIST { break; }

        let p = ro + rd * t;
        let d = map(p);

        if d > FUR_DEPTH {
            t += d - FUR_DEPTH + FUR_STEP;
            continue;
        }

        if d >= 0.0 {
            // let n = getNormal(p);
            // let fiberDir = n;

            // TODO(bret): figure out origin
            let o = vec3f(0.0);
            let fiberDir = normalize(p - o);
            let viewDir = -rd;
            let grazing = 1. - abs(dot(fiberDir, viewDir));

            let fur = smoothstep(FUR_DEPTH, 0.0, d);
            let noiseRaw = noise3D(p * 3.);
            let noise = mix(.5, 1., noiseRaw);
            let densitySample = fur * noise * (1.0 + grazing * 2.0);
            density += densitySample * FUR_STEP * FUR_DENSITY;

            t += FUR_STEP;
            continue;
        }

        break;
    }

    let alpha = 1.0 - exp(-density);
    return vec4f(density, 0.0, 0.0, 0.0);
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

struct FragmentOutput {
    @location(0) color: vec4f,
    // @builtin(frag_depth) depth: f32,
};

@fragment
fn fs(in: VertexOutput) -> FragmentOutput {
    let nearClip = uniforms.invVpMatrix * vec4f(in.uv_ndc.x, in.uv_ndc.y, 0.0, 1.0);
    let nearWorld = nearClip.xyz / nearClip.w;

    let farClip = uniforms.invVpMatrix * vec4f(in.uv_ndc.x, in.uv_ndc.y, 1.0, 1.0);
    let farWorld = farClip.xyz / farClip.w;

    let ro = nearWorld;
    let rd = normalize(farWorld - ro);

    let maxSceneT = getSceneDepthDistance(in.uv_norm, ro, rd, uniforms.invVpMatrix);

    // let pixelScale = length(dpdx(rd)) + length(dpdy(rd));

    // let res = rayMarch(ro, rd, maxSceneT);
    let res = rayMarchFur(ro, rd, maxSceneT);
    let t = res.x;
    if t >= maxSceneT || t > MAX_DIST { discard; }

    let p = ro + rd * t;
    let n = getNormal(p);

    let lightDir = normalize(vec3f(0.5, 1.0, 1.4));

    // let diffuse = max(dot(n, lightDir), 0.0); // dull
    let diffuse = dot(n, lightDir) * 0.5 + 0.5; // vibrant

    let ambient = 0.15;
    let lighting = clamp(ambient + diffuse, 0.0, 1.0);

    var baseColor = COLORS[u32(res.y)];
    let finalColor = baseColor * lighting;

    var out: FragmentOutput;
    // out.color = vec4f(finalColor, 1.0);
    out.color = vec4f(vec3f(t), 1.0);
    // out.depth = hitDepth;

    return out;
}
