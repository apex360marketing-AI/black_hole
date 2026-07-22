// Shared fullscreen-triangle/quad vertex shader used by every render pass.
// No camera/projection matrices are involved: geometry is fed directly in clip space.
export const fullscreenVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
