import React, { useEffect, useRef, useState } from 'react';

interface DitherShaderProps {
  className?: string;
  gridSize?: number;
  contrast?: number;
}

export const DitherShader: React.FC<DitherShaderProps> = ({
  className = '',
  gridSize = 3,
  contrast = 1.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const isVisibleRef = useRef<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // IntersectionObserver to pause rendering when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Try WebGL
    const rawGl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    if (!rawGl) {
      setHasWebGL(false);
      return () => observer.disconnect();
    }
    const gl: WebGLRenderingContext = rawGl;

    // Vertex Shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment Shader with 4x4 Bayer Matrix Ordered Dithering
    const fsSource = `
      precision mediump float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_contrast;

      // 4x4 Bayer matrix normalized to 0.0 .. 1.0
      float getBayer(vec2 coord) {
        int x = int(mod(coord.x, 4.0));
        int y = int(mod(coord.y, 4.0));
        int index = x + y * 4;

        if (index == 0) return 0.0 / 16.0;
        if (index == 1) return 8.0 / 16.0;
        if (index == 2) return 2.0 / 16.0;
        if (index == 3) return 10.0 / 16.0;
        if (index == 4) return 12.0 / 16.0;
        if (index == 5) return 4.0 / 16.0;
        if (index == 6) return 14.0 / 16.0;
        if (index == 7) return 6.0 / 16.0;
        if (index == 8) return 3.0 / 16.0;
        if (index == 9) return 11.0 / 16.0;
        if (index == 10) return 1.0 / 16.0;
        if (index == 11) return 9.0 / 16.0;
        if (index == 12) return 15.0 / 16.0;
        if (index == 13) return 7.0 / 16.0;
        if (index == 14) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      // Procedural organic fog and signal field
      float noise(vec2 p) {
        return sin(p.x * 3.5 + u_time * 0.25) * cos(p.y * 3.5 + u_time * 0.2) * 0.5 + 0.5;
      }

      void main() {
        vec2 pixelCoord = gl_FragCoord.xy / ${gridSize.toFixed(1)};
        
        // Procedural organic signal density
        vec2 uv = v_uv;
        float wave1 = noise(uv * 2.2);
        float wave2 = noise(uv * 4.5 + vec2(u_time * 0.1, -u_time * 0.12));
        float signal = mix(wave1, wave2, 0.45);
        
        // Center vignette & negative space
        float distFromCenter = distance(uv, vec2(0.5, 0.5));
        float vignette = smoothstep(0.85, 0.2, distFromCenter);
        float lum = signal * vignette * u_contrast;

        // Apply Bayer threshold
        float threshold = getBayer(pixelCoord);
        float dither = lum > threshold ? 0.88 : 0.05;

        // Pure monochrome tone
        gl_FragColor = vec4(vec3(dither), 0.75);
      }
    `;

    function compileShader(source: string, type: number): WebGLShader | null {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) {
      setHasWebGL(false);
      return () => observer.disconnect();
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setHasWebGL(false);
      return () => observer.disconnect();
    }

    gl.useProgram(program);

    // Full screen quad buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uContrast = gl.getUniformLocation(program, 'u_contrast');

    let animId: number;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = () => {
      if (!isVisibleRef.current) {
        // Paused when offscreen
        animId = requestAnimationFrame(render);
        return;
      }

      resize();
      const elapsed = (performance.now() - startTime) * 0.001;

      gl.useProgram(program);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uContrast, contrast);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    resize();
    render();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) gl.deleteProgram(program);
    };
  }, [gridSize, contrast]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {hasWebGL ? (
        <canvas
          ref={canvasRef}
          className="w-full h-full block opacity-70"
          style={{ imageRendering: 'pixelated' }}
          aria-hidden="true"
        />
      ) : (
        // High-fidelity SVG static Bayer dither fallback for non-WebGL/reduced-motion environments
        <div
          className="w-full h-full bg-[#080808]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(242, 242, 242, 0.12) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
