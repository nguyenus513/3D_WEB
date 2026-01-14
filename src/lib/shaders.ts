// Jelly Distortion Vertex Shader
// Creates a wave/jelly effect based on scroll velocity

export const jellyVertexShader = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uStrength;
  
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Distortion based on speed and position
    float distortion = sin(pos.y * 3.14159) * uSpeed * uStrength;
    pos.x += distortion * 0.3;
    pos.z += distortion * 0.1;
    
    // Subtle wave effect
    pos.x += sin(pos.y * 5.0 + uTime * 2.0) * uSpeed * 0.02;
    pos.y += cos(pos.x * 5.0 + uTime * 2.0) * uSpeed * 0.01;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// RGB Shift Fragment Shader
// Creates chromatic aberration effect based on velocity

export const rgbShiftFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOffset;
  uniform float uOpacity;
  
  varying vec2 vUv;
  
  void main() {
    // RGB channel separation
    float r = texture2D(uTexture, vUv + vec2(uOffset, 0.0)).r;
    float g = texture2D(uTexture, vUv).g;
    float b = texture2D(uTexture, vUv - vec2(uOffset, 0.0)).b;
    float a = texture2D(uTexture, vUv).a;
    
    gl_FragColor = vec4(r, g, b, a * uOpacity);
  }
`;

// Basic Fragment Shader for texture display
export const basicFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  
  varying vec2 vUv;
  
  void main() {
    vec4 color = texture2D(uTexture, vUv);
    gl_FragColor = vec4(color.rgb, color.a * uOpacity);
  }
`;

// Gradient Background Vertex Shader
export const gradientVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Animated Gradient Fragment Shader
export const gradientFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  
  varying vec2 vUv;
  
  void main() {
    // Animated gradient
    float noise = sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5;
    noise += sin(vUv.y * 8.0 - uTime * 0.5) * 0.5 + 0.5;
    noise *= 0.5;
    
    vec3 color = mix(uColor1, uColor2, vUv.y);
    color = mix(color, uColor3, noise * 0.3);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Wave distortion for images
export const waveVertexShader = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;
  
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Wave effect
    float wave = sin(pos.x * uFrequency + uTime) * uAmplitude;
    wave += sin(pos.y * uFrequency * 0.5 + uTime * 0.7) * uAmplitude * 0.5;
    
    pos.z += wave;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
