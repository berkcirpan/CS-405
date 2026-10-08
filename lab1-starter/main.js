// CS405 · Lab 1

const canvas = document.querySelector('canvas');
if (!navigator.gpu) throw new Error('WebGPU not available');

const adapter = await navigator.gpu.requestAdapter();

const device = await adapter.requestDevice();
const ctx = canvas.getContext('webgpu');

const format = navigator.gpu.getPreferredCanvasFormat();
ctx.configure({ device, format, alphaMode: 'opaque' });
console.log('WebGPU ready:', format);

const shader = device.createShaderModule({
  code: `
    struct Uniforms {
      time: f32,
      aspect: f32,
      mouse: vec2f,
    }
    @group(0) @binding(0) var<uniform> u: Uniforms;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) colour: vec3f,
    }

    @vertex
    fn vs(@builtin(vertex_index) index: u32) -> VertexOutput {
      let positions = array<vec2f, 6>(
        vec2f(-0.25, 0.25), vec2f(-0.25, -0.25), vec2f(0.25, -0.25),
        vec2f(-0.25, 0.25), vec2f(0.25, -0.25), vec2f(0.25, 0.25)
      );
      let colours = array<vec3f, 6>(
        vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0),
        vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), vec3f(1.0, 1.0, 0.0)
      );
      let a = u.time;
      let R = mat2x2f(cos(a), sin(a), -sin(a), cos(a));
      let S = mat2x2f(1.5, 0.0, 0.0, 0.6);
      let p = positions[index];
      let q = R * p;
      var output: VertexOutput;
      output.position = vec4f(vec2f(q.x / u.aspect, q.y) + u.mouse, 0.0, 1.0);
      output.colour = colours[index];
      return output;
    }

    @fragment
    fn fs(input: VertexOutput) -> @location(0) vec4f {
      return vec4f(input.colour, 1.0);
    }
  `,
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: shader, entryPoint: 'vs' },
  fragment: {
    module: shader,
    entryPoint: 'fs',
    targets: [{ format }],
  },
  primitive: { topology: 'triangle-list' },
});

const ubuf = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: ubuf } }],
});

const mouse = { x: 0, y: 0 };
canvas.addEventListener('pointermove', (event) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = 1 - ((event.clientY - r.top) / r.height) * 2;
});

const t0 = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame() {
  const time = (performance.now() - t0) * 0.001;
  const aspect = canvas.width / canvas.height;
  device.queue.writeBuffer(ubuf, 0, new Float32Array([time, aspect, mouse.x, mouse.y]));

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0.05, g: 0.35, b: 0.75, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(6);
  pass.end();
  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}
frame();
