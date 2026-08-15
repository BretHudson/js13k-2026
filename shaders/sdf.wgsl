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

fn sdBoxRound(p: vec3f, b: vec3f, roundFactor: f32) -> f32 {
    let maxR = min(b.x, min(b.y, b.z));
    let rad = maxR * clamp(roundFactor, 0.0, 1.0);

    let q = abs(p) - (b - vec3f(rad));
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - rad;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// distance map

fn minSdf(a: vec2f, b: vec2f) -> vec2f {
    if a.x < b.x { return a; }
    return b;
}

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

fn rotX(p: vec3f, a: f32) -> vec3f {
    return vec3f(p.x, rot2D(p.yz, a));
}

fn rotY(p: vec3f, a: f32) -> vec3f {
    let r = rot2D(p.xz, a);
    return vec3f(r.x, p.y, r.y);
}

fn rotZ(p: vec3f, a: f32) -> vec3f {
    return vec3f(rot2D(p.xy, a), p.z);
}

fn map(p: vec3f) -> vec2f {
    var q = p;
    q *= .7;
    q.y -= .8;

    let torsoPos = vec3f(.0, -0.07, .0);

    let torso = sdBoxRound(q - torsoPos, vec3f(.6, .4, 1), 1.);
    var unicorn = vec2f(torso, C_WHITE);

    let headPos = vec3f(0, .6, -.98);
    let head = sdBoxRound(q - headPos, vec3f(.27, .26, .52), 1.);
    unicorn = minSdf(unicorn, vec2f(head, C_WHITE));

    let hornPos = rotX(q - vec3f(.0, .99, -1.42), .5);
    let horn = sdBoxRound(hornPos, vec3f(0.04, .22, 0.04), 1.);
    unicorn = minSdf(unicorn, vec2f(horn, C_SILVER));

    let manePos = rotX(q - vec3f(.0, .68, -.5), -.77);
    let mane = sdBoxRound(manePos, vec3f(0.07, .29, .37), .2);
    unicorn = minSdf(unicorn, vec2f(mane, C_PINK));

    let tailPos = rotX(q - vec3f(.0, -.25, 1.15), -.8);
    let tail = sdBoxRound(tailPos, vec3f(.14, .22, .47), .15);
    unicorn = minSdf(unicorn, vec2f(tail, C_PINK));

    // mirroed
    q.x = abs(q.x);
    q.z = abs(q.z);

    let legPos = vec3f(.5, -.4, .6);
    let leg = sdBoxRound(q - legPos, vec3f(.135, .45, .235), 0.75);
    unicorn = minSdf(unicorn, vec2f(leg, C_WHITE));

    let hoofPos = vec3f(.5, -.7, .6);
    let hoof = sdBoxRound(q - hoofPos, vec3f(.14, .15, .24), 0.75);
    unicorn = minSdf(unicorn, vec2f(hoof, C_OFF_WHITE));

    return unicorn;
}

fn getNormal(p: vec3f) -> vec3f {
    let h = 0.001;
    let k = vec2f(1.0, -1.0);
    return normalize(
        k.xyy * map(p + k.xyy * h).x +
        k.yxy * map(p + k.yxy * h).x +
        k.yyx * map(p + k.yyx * h).x +
        k.xxx * map(p + k.xxx * h).x
    );
}

// raymarch
const MIN_DIST: f32 = 0.001;
const MAX_DIST: f32 = 1000.0;
const MAX_STEPS: i32 = 64;

fn rayMarch(ro: vec3f, rd: vec3f, maxT: f32, pixelScale: f32) -> vec4f {
    var t = 0.0;
    var lastMat = 0.0;
    var minDistanceRatio = 1.0;
    var hit = false;

    for (var i = 0; i < MAX_STEPS; i++) {
        let p = ro + rd * t;
        let res = map(p);
        let d = res.x;
        lastMat = res.y;

        let pixelRadius = max(t * pixelScale, 0.0005);

        minDistanceRatio = min(minDistanceRatio, d / pixelRadius);

        if d < MIN_DIST {
            hit = true;
            break;
        }

        t += d;

        if t >= maxT || t > MAX_DIST { break; }
    }

    var alpha = 0.0;
    if hit {
        alpha = 1.0;
    } else if minDistanceRatio < 1. {
        alpha = clamp(1.0 - minDistanceRatio, 0.0, 1.0);
    }

    return vec4f(t, lastMat, alpha, 0.0);
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

    let pixelScale = length(dpdx(rd)) + length(dpdy(rd));

    let res = rayMarch(ro, rd, maxSceneT, pixelScale);
    let t = res.x;
    let alpha = res.z;

    if alpha < 0.001 { discard; }
    if t >= maxSceneT || t > MAX_DIST { discard; }

    let p = ro + rd * t;
    let n = getNormal(p);

    let sunDir = normalize(vec3f(0.5, 1.0, .4));
    let sunColor = vec3f(1., .95, .78);
    let skyColor = vec3f(.25, .45, .6);

    let viewDir = normalize(ro - p);
    let halfVec = normalize(sunDir + viewDir);

    // TODO(bret): update this to more match the mesh shader
    // let diff = max(dot(n, sunDir), 0.0); // dull
    let diff = dot(n, sunDir) * 0.5 + 0.5; // vibrant
    // let spec = pow(max(dot(n, halfVec), 0.0), 32.0);

    var baseColor = COLORS[u32(res.y)];
    let lighting = (sunColor * diff * 0.7 + .2) + (skyColor * .4);
    let finalColor = clamp(baseColor * lighting, vec3f(0.0), vec3f(1.0));

    let hitDepth = 0.0;

    var out: FragmentOutput;
    out.color = vec4f(finalColor, 1.0);
    // out.depth = hitDepth;

    return out;
}
