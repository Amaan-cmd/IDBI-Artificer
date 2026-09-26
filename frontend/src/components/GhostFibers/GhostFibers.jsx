import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import './GhostFibers.css';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

const int u_line_count = 18;
const float u_line_width = 4.0;
const float u_line_blur = 6.0;

float Perlin2D(vec2 P) {
    vec2 Pi = floor(P);
    vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
    vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
    Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
    Pt += vec2(26.0, 161.0).xyxy;
    Pt *= Pt;
    Pt = Pt.xzxz * Pt.yyww;
    vec4 hash_x = fract(Pt * (1.0 / 951.135664));
    vec4 hash_y = fract(Pt * (1.0 / 642.949883));
    vec4 grad_x = hash_x - 0.49999;
    vec4 grad_y = hash_y - 0.49999;
    vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
        * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
    grad_results *= 1.4142135623730950;
    vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
               * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
    vec4 blend2 = vec4(blend, vec2(1.0 - blend));
    return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 resolution) {
    return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
    float split_offset = (perc * 0.4);
    float split_point = 0.08 + split_offset;

    float amplitude_normal = smoothstep(split_point, 0.75, st.x);
    float amplitude_strength = 0.55;
    float finalAmplitude = amplitude_normal * amplitude_strength
                           * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

    float time_scaled = time / 14.0 + (mouse.x - 0.5) * 0.6;
    float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

    float xnoise = mix(
        Perlin2D(vec2(time_scaled, st.x + perc) * 2.0),
        Perlin2D(vec2(time_scaled, st.x + time_scaled) * 2.8) / 1.6,
        st.x * 0.35
    );

    float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

    float line_start = smoothstep(
        y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        y,
        st.y
    );

    float line_end = smoothstep(
        y,
        y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
        st.y
    );

    return clamp(
        (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.35))),
        0.0,
        1.0
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float line_strength = 0.0;
    for (int i = 0; i < u_line_count; i++) {
        float p = float(i) / float(u_line_count);
        line_strength += lineFn(
            uv,
            u_line_width * pixel(1.0, iResolution.xy),
            p,
            (p * 0.1),
            uMouse,
            iTime,
            uAmplitude,
            uDistance
        );
    }

    float c = clamp(line_strength, 0.0, 1.0);
    fragColor = vec4(uColor * c, c);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

export default function GhostFibers({
  color = [0.78, 0.66, 0.42], // Warm champagne gold
  amplitude = 1.0,
  distance = 0.0,
  enableMouse = true,
  opacity = 0.18
}) {
  const containerRef = useRef(null);
  const animFrameId = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        premultipliedAlpha: false
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    if (!gl) return;

    gl.clearColor(0, 0, 0, 0);

    const geometry = new Triangle(gl);
    const c = new Color(...color);

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1, 1]) },
        uColor: { value: new Float32Array([c.r, c.g, c.b]) },
        uAmplitude: { value: amplitude },
        uDistance: { value: distance },
        uMouse: { value: new Float32Array([0.5, 0.5]) }
      },
      transparent: true
    });

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      program.uniforms.iResolution.value[0] = w;
      program.uniforms.iResolution.value[1] = h;
      program.uniforms.iResolution.value[2] = w / (h || 1);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    container.appendChild(gl.canvas);

    let currentMouse = [0.5, 0.5];
    let targetMouse = [0.5, 0.5];

    function handleMouseMove(e) {
      if (!enableMouse) return;
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      targetMouse = [x, y];
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    function update(t) {
      animFrameId.current = requestAnimationFrame(update);
      if (document.hidden) return;

      if (enableMouse) {
        currentMouse[0] += 0.04 * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += 0.04 * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }

      program.uniforms.iTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    }

    animFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      if (container && gl.canvas && container.contains(gl.canvas)) {
        container.removeChild(gl.canvas);
      }
    };
  }, [color, amplitude, distance, enableMouse]);

  return (
    <div className="ghost-fibers-wrapper" aria-hidden="true">
      <div ref={containerRef} className="ghost-fibers-canvas" style={{ opacity }} />
    </div>
  );
}
