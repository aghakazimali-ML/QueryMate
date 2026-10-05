import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Procedural "molten metal folds" shader (raw WebGL, no dependencies).
 * Domain-warped fbm height field -> finite-difference normals -> diffuse + specular + fresnel lighting.
 * Reacts to the pointer (bends folds, moves the light) and to page scroll (shifts the fold phase).
 */

export interface ShaderPalette {
  /** Shadow / base metal colour. */
  deep: string;
  /** Main body colour. */
  body: string;
  /** Specular highlight colour. */
  shine: string;
}

export const AMBER_HEARTH: ShaderPalette = { deep: "#120a05", body: "#c2610c", shine: "#ffd98a" };

interface Props {
  className?: string;
  palette?: ShaderPalette;
  /** Fold depth / warp strength (0.5 – 3). */
  fold?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Zoom of the pattern. */
  scale?: number;
  /** Extra glow around the pointer (0 – 1). */
  glow?: number;
  /** Render resolution relative to CSS pixels (lower = faster). */
  resolution?: number;
  /** Follow the pointer anywhere on the page, not just over the canvas. */
  interactive?: boolean;
  /** Static seed so several canvases don't look identical. */
  seed?: number;
  /** Frame-rate cap (use a low value for ambient backgrounds). */
  fps?: number;
}

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uScroll;
uniform vec3 uDeep; uniform vec3 uBody; uniform vec3 uShine;
uniform float uFold; uniform float uScale; uniform float uGlow; uniform float uSeed;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++){ v += a*noise(p); p = r*p*2.02 + 3.1; a *= 0.5; }
  return v;
}
float height(vec2 p){
  float t = uTime;
  vec2 q = vec2(fbm(p + vec2(uSeed, t*0.07)), fbm(p + vec2(5.2 - t*0.05, 1.3 + uSeed)));
  float h = fbm(p + uFold*q + vec2(uScroll*0.8, 0.0));
  // turn the warped field into sharp metallic folds
  return 0.5 + 0.5*sin(h*9.0 + p.y*1.2 - t*0.35);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  vec2 m = (uMouse - 0.5*uRes) / uRes.y;
  vec2 d = uv - m;
  float pull = exp(-dot(d, d)*6.0);
  vec2 p = uv*uScale + d*0.35*pull;

  float e = 0.004;
  float h = height(p);
  float hx = height(p + vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e));
  vec3 n = normalize(vec3((h - hx)/e*0.012, (h - hy)/e*0.012, 0.18));

  vec3 l = normalize(vec3(m*1.4 + vec2(0.3, 0.6), 0.9));
  vec3 v = vec3(0.0, 0.0, 1.0);
  float diff = clamp(dot(n, l), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-l, n), v), 0.0, 1.0), 28.0);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);

  vec3 col = mix(uDeep, uBody, smoothstep(0.05, 0.95, h*diff));
  col += uShine*spec*1.1 + uBody*fres*0.6;
  col += uShine*pull*uGlow*0.35;
  float vig = smoothstep(1.35, 0.25, length(uv));
  col *= mix(0.35, 1.0, vig);
  col = pow(col, vec3(0.95));
  gl_FragColor = vec4(col, 1.0);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
  return s;
}

export function ShaderCanvas({
  className,
  palette = AMBER_HEARTH,
  fold = 1.8,
  speed = 1,
  scale = 1.6,
  glow = 0.6,
  resolution = 0.6,
  interactive = true,
  seed = 0,
  fps = 60,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) {
      canvas.style.background = `radial-gradient(circle at 30% 30%, ${palette.body}, ${palette.deep})`;
      return;
    }
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      gl.useProgram(program);
    } catch (err) {
      console.warn("Shader failed, using gradient fallback", err);
      canvas.style.background = `radial-gradient(circle at 30% 30%, ${palette.body}, ${palette.deep})`;
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uScroll = u("uScroll");
    gl.uniform3fv(u("uDeep"), hexToRgb(palette.deep));
    gl.uniform3fv(u("uBody"), hexToRgb(palette.body));
    gl.uniform3fv(u("uShine"), hexToRgb(palette.shine));
    gl.uniform1f(u("uFold"), fold);
    gl.uniform1f(u("uScale"), scale);
    gl.uniform1f(u("uGlow"), glow);
    gl.uniform1f(u("uSeed"), seed);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = true;
    let raf = 0;
    const start = performance.now();
    let last = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * resolution;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      if (!mouse.tx && !mouse.ty) {
        mouse.tx = mouse.x = w * 0.62;
        mouse.ty = mouse.y = h * 0.58;
      }
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const s = canvas.width / Math.max(1, rect.width);
      mouse.tx = (e.clientX - rect.left) * s;
      mouse.ty = (rect.height - (e.clientY - rect.top)) * s;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 1000 / fps - 2) return;
      last = now;
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 4 : ((now - start) / 1000) * speed);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uScroll, window.scrollY / Math.max(1, window.innerHeight));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);
    const onVisibility = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    if (interactive) window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [palette, fold, speed, scale, glow, resolution, interactive, seed, fps]);

  return <canvas ref={ref} aria-hidden className={cn("block h-full w-full", className)} />;
}
