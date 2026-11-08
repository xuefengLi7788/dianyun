const canvas = document.querySelector('canvas');
const fallback = document.querySelector('.fallback');
const status = document.querySelector('.status');
const anatomyLabel = document.querySelector('.anatomy-label');
const [anatomyChinese, anatomyEnglish] = anatomyLabel.children;
const modelButtons = [...document.querySelectorAll('[data-model]')];
const resetButton = document.querySelector('#reset');
const soundButton = document.querySelector('#sound');
const breath = document.querySelector('#breath');
let breathEnvelope = null;

function breathExpansion() {
  const position = breath.currentTime * 50;
  const index = Math.min(Math.floor(position), breathEnvelope.length - 1);
  const next = Math.min(index + 1, breathEnvelope.length - 1);
  const mix = position % 1;
  return (breathEnvelope[index] * (1 - mix) + breathEnvelope[next] * mix) / 200;
}

function updateSoundButton() {
  soundButton.textContent = breath.paused ? 'Ventilator Off' : 'Ventilator On';
  soundButton.setAttribute('aria-pressed', String(!breath.paused));
}

soundButton.addEventListener('click', async () => {
  if (!breath.paused) {
    breath.pause();
    return;
  }
  try {
    await breath.play();
  } catch {
    soundButton.textContent = 'Retry ventilator';
  }
});
breath.addEventListener('play', updateSoundButton);
breath.addEventListener('pause', updateSoundButton);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const POINTS = 54000;
const TRAIL_POINTS = 420;
const BACKGROUND_POINTS = 1800;
// Keep the third path registered to the original projection after trimming its stray strands.
const thirdTrailBounds = [-0.28609207, -0.46638510, 0.28968155, 0.50130242];

// Cubic curves traced from the reference, in each form's front-view coordinates.
const trailPaths = [
  [[.35,.38,.22,.04,.38,.03,.64,.24],[.64,.24,.82,.40,.61,.51,.76,.45],[.76,.45,.87,.43,1.11,.36,.88,.49]],
  [[-.34,.31,-.29,.43,-.12,.50,.13,.52],[.13,.52,.27,.53,.33,.56,.28,.62]],
  [
    [.415,.204,.435,.194,.510,.183,.550,.170],
    [.550,.170,.674,.147,.754,.043,.866,.054],
    [.866,.054,.962,.063,1.065,.165,1.047,.268],
    [1.047,.268,1.032,.365,.934,.398,.861,.432],
    [.861,.432,.806,.456,.764,.463,.740,.480],
    [.740,.480,.709,.498,.692,.526,.675,.556],
    [.675,.556,.669,.572,.660,.586,.667,.607],
  ],
];

// Depth controls for the third form: buried starts/ends and a shared lower strand.
const thirdTrailDepth = [
  [.13,.18,.13,.065],
  [.065,.07,.095,.10],
  [.10,.08,.055,.045],
  [.045,.045,.047,.055],
  [.055,.042,.015,-.012],
  [-.012,-.018,.030,.036],
  [.036,.032,-.045,-.13],
];

function traceTrail(curves, bounds, time, result, depthControls) {
  const [left,bottom,right,top] = bounds;
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const phase = (i / TRAIL_POINTS + time * .28) % 1;
    const progress = phase * curves.length;
    const segment = Math.floor(progress);
    const curve = curves[segment];
    const t = progress % 1;
    const a = 1 - t;
    const weights = [a*a*a,3*a*a*t,3*a*t*t,t*t*t];
    let x = 0, y = 0;
    for (let j = 0; j < 4; j++) {
      x += weights[j] * curve[j*2];
      y += weights[j] * curve[j*2+1];
    }
    // Alternate in front of and behind the scanned surface along the curve.
    const depth = depthControls
      ? weights.reduce((sum, weight, j) => sum + weight * depthControls[segment][j], 0)
      : .04 + .39 * Math.cos(phase * Math.PI * 2.0);
    const z = depth + .012 * Math.sin(i * 2.4);
    const spreadX = .004 * Math.sin(i * 5.3);
    const spreadY = .004 * Math.sin(i * 3.7 + 1.2);
    result[i*3] = (left + x * (right-left) + spreadX) * (1 - .28*z);
    result[i*3+1] = (top - y * (top-bottom) + spreadY) * (1 - .28*z);
    result[i*3+2] = z;
  }
}

const vertexShader = `
attribute vec3 point;
attribute float referenceTone;
uniform vec2 viewport, orbit, offset, cursor;
uniform float cursorStrength;
uniform mediump float flow;
uniform float size, pixelRatio, scatter, time, seed, inflation;
uniform vec2 inflationRadii;
varying mediump float light;
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float id = dot(point, vec3(311.7, 419.3, 157.9)) + seed;
  vec3 randomDirection = vec3(hash(id), hash(id + 18.0), hash(id + 32.0)) - .5;
  if (flow > 2.5) {
    float t = point.x * 6.2831853;
    float strand = point.y;
    float theta = t + time * (.085 + strand * .014);
    float twist = theta * 3.0 + strand * 2.094;
    float radiusX = min(viewport.x * .43, viewport.y * .74);
    float radiusY = viewport.y * .37;
    float separation = (strand - 1.0) * .065;
    vec2 center = vec2(cos(theta) * (1.0 + separation),
                       sin(theta) * (.91 + separation));
    center.x += .12 * sin(2.0 * theta + .45 * strand);
    center.y += .15 * cos(3.0 * theta + .55 * strand);
    vec2 drift = vec2(cos(twist), sin(twist)) * (.012 + .075 * point.z * point.z);
    vec2 vessel = (center + drift) * vec2(radiusX, radiusY);
    gl_Position = vec4(vessel / viewport * 2.0, .95, 1.0);
    gl_PointSize = max(1.65, pixelRatio * (1.1 + point.z * .65));
    float current = .5 + .5 * sin(theta * 7.0 - time * 1.15 + strand);
    light = (.20 + .30 * point.z) * (.58 + .42 * current);
    return;
  }
  bool isTrail = flow > .5 && flow < 1.5;
  vec3 p = point + randomDirection * (isTrail ? 0.0 : scatter) * (0.65 + hash(id + 71.0));
  if (!isTrail) {
    vec2 normalizedPoint = point.xy / inflationRadii;
    float edge = max(abs(normalizedPoint.x), abs(normalizedPoint.y));
    float interior = 1.0 - smoothstep(.58, .96, edge);
    // Separate nearby particles within each lobe while tapering near the outer edges.
    vec3 tissue = sin(point * vec3(22.0, 19.0, 16.0));
    vec3 swelling = vec3(normalizedPoint * .038, point.z * .15) + tissue * .015;
    p += swelling * (inflation * interior);
  }
  float cy = cos(orbit.x), sy = sin(orbit.x), cx = cos(orbit.y), sx = sin(orbit.y);
  p = vec3(cy * p.x + sy * p.z, p.y, cy * p.z - sy * p.x);
  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
  float perspective = 1.0 / (1.0 - .28 * p.z);
  vec2 screen = offset + p.xy * size * perspective;
  vec2 fromCursor = screen - cursor;
  float distanceToCursor = length(fromCursor);
  float influence = (1.0 - smoothstep(0.0, 42.0, distanceToCursor)) * cursorStrength;
  if (!isTrail) {
    screen -= fromCursor * (.92 * sqrt(influence));
  }
  gl_Position = vec4(screen / viewport * 2.0, clamp(-p.z * .85, -.98, .98), 1.0);
  gl_PointSize = max(1.0, pixelRatio * (0.59 + hash(id + 47.0) * .52) * (1.0 + inflation * .14));
  light = (.16 + .52 * hash(id + 53.0)) * (.88 + .12 * sin(time + id)) * clamp(.68 + p.z * .83,.22,1.0);
  if (seed > 30.0 && seed < 40.0) {
    light *= mix(.20, 1.30, smoothstep(-.32, .25, p.z));
    float frontView = smoothstep(.45, .98, cos(orbit.x) * cos(orbit.y));
    if (referenceTone < 0.0) {
      light *= mix(1.25, .09, frontView);
    } else {
      float surface = mix(.15, 1.85, smoothstep(.10, .94, referenceTone));
      light *= surface * mix(.20, 1.0, frontView);
    }
  }
  if (isTrail) {
    light = .26 + .64 * pow(.5 + .5 * sin(time * 8.0 - float(id) * .27), 3.0);
    gl_PointSize = max(1.0, pixelRatio * 1.05);
  } else if (flow > 1.5) {
    gl_PointSize = 3.6 * pixelRatio;
  }
}`;
const fragmentShader = `
precision mediump float;
uniform mediump float flow;
varying mediump float light;
void main() {
  float radius = length(gl_PointCoord - vec2(.5));
  if (flow > 1.5 && flow < 2.5 && (radius > .48 || light < .042)) discard;
  gl_FragColor = vec4(1.0,.025,.017, light * (1.0 - smoothstep(.28,.7,radius)));
}`;

async function start() {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true });
  if (!gl) throw Error('WebGL unavailable');
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  const response = await fetch('anatomy.bin');
  if (!response.ok) throw Error('Point data unavailable');
  const points = new Float32Array(await response.arrayBuffer());
  if (points.length !== POINTS * 12) throw Error('Unexpected point data');
  const modelBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(location);
  const toneLocation = gl.getAttribLocation(program, 'referenceTone');
  const uniforms = Object.fromEntries(['viewport','orbit','offset','cursor','cursorStrength','flow','size','pixelRatio','scatter','time','seed','inflation','inflationRadii'].map(name => [name, gl.getUniformLocation(program, name)]));
  const backgroundBuffer = gl.createBuffer();
  const background = new Float32Array(BACKGROUND_POINTS * 3);
  for (let i = 0; i < BACKGROUND_POINTS; i++) {
    background[i * 3] = (i % 600) / 600;
    background[i * 3 + 1] = Math.floor(i / 600);
    background[i * 3 + 2] = (i * .61803398875) % 1;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, background, gl.STATIC_DRAW);
  const trailBuffer = gl.createBuffer();
  const trail = new Float32Array(TRAIL_POINTS * 3);
  const bounds = trailPaths.map((_, index) => {
    if (index === 2) return thirdTrailBounds;
    let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity;
    for (let i = index * POINTS * 4; i < (index + 1) * POINTS * 4; i += 4) {
      const perspective = 1 / (1 - .28 * points[i+2]);
      const x = points[i] * perspective, y = points[i+1] * perspective;
      left = Math.min(left,x); right = Math.max(right,x);
      bottom = Math.min(bottom,y); top = Math.max(top,y);
    }
    return [left,bottom,right,top];
  });
  gl.clearColor(0.012, 0.012, 0.012, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  let active = 0, yaw = 0, pitch = 0, zoom = 1, burst = -Infinity;
  let drag = null, frame = 0;
  const hover = {x: 0, y: 0, active: false, strength: 0};
  let previousFrame = 0, expansion = 0;
  // Approximate regions in each model’s original front view. The labels
  // follow the source coordinates of the hit particle when the model rotates.
  const anatomyRegions = [
    [
      [[.36,.30,.57,.68], '胸骨区 · Sternal Region'],
      [[0,0,1,.33], '上位肋骨 · Upper Ribs'],
      [[0,.70,.52,1], '肋弓 · Costal Margin'],
      [[0,.48,.36,.70], '肋间区 · Intercostal Region'],
      [[.52,.72,1,1], '下位肋骨 · Lower Ribs'],
      [[.57,.33,.79,.69], '肋软骨区 · Costal Cartilage Region'],
    ],
    [
      [[.39,0,.58,.27], '气管 · Trachea'],
      [[.37,.27,.61,.48], '主支气管区 · Main Bronchial Region'],
      [[.10,.49,.38,.83], '心脏区 · Cardiac Region'],
      [[0,.83,1,1], '肺底 · Lung Base'],
      [[0,0,1,.28], '肺尖 · Lung Apex'],
      [[0,.64,1,1], '下肺区 · Lower Lung Region'],
    ],
    [
      [[0,0,1,.16], '鼻梁 · Nasal Bridge'],
      [[.23,.16,.54,.38], '鼻甲区 · Turbinate Region'],
      [[0,.25,.23,.48], '上颌窦区 · Maxillary Sinus Region'],
      [[.47,.35,.71,.52], '鼻咽区 · Nasopharyngeal Region'],
      [[.56,.52,.78,.63], '胃入口（贲门）· Gastric Cardia'],
      [[.78,.52,1,.71], '胃底 · Gastric Fundus'],
      [[0,.89,1,1], '胃出口（幽门）· Pyloric Region'],
      [[0,.75,.71,.89], '胃窦 · Gastric Antrum'],
    ],
  ];
  function anatomyName(index) {
    const [left,bottom,right,top] = bounds[active];
    const perspective = 1 / (1 - .28 * points[index+2]);
    const x = (points[index] * perspective - left) / (right - left);
    const y = (top - points[index+1] * perspective) / (top - bottom);
    const region = anatomyRegions[active].find(([[x0,y0,x1,y1]]) =>
      x >= x0 && x <= x1 && y >= y0 && y <= y1);
    if (region) return region[1];
    if (active === 0) return '肋骨体 · Rib Shaft';
    if (active === 1) return '肺叶 · Lung Lobe';
    return y < .52 ? '鼻腔 · Nasal Cavity' : '胃体 · Gastric Body';
  }

  function updateAnatomyLabel(width, height, scale) {
    if (!hover.active || drag) {
      anatomyLabel.hidden = true;
      return;
    }

    // Use the same camera projection as the shader to hit-test model particles.
    const mx = hover.x - width / 2, my = height / 2 - hover.y;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    let nearestDistance = 17 ** 2;
    let hit = -1;
    const start = active * POINTS * 4;
    const end = start + POINTS * 4;
    for (let i = start; i < end; i += 4 * 23) {
      const x = points[i], y = points[i+1], z = points[i+2];
      if (active === 1 && points[i+3] < 0 && cy * cx > .8) continue;
      const u = cy * x + sy * z;
      const depth = cy * z - sy * x;
      const v = cx * y - sx * depth;
      const perspective = scale / (1 - .28 * (sx * y + cx * depth));
      const dx = u * perspective - mx, dy = v * perspective - my;
      const distance = dx * dx + dy * dy;
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      hit = i;
    }

    anatomyLabel.hidden = hit < 0;
    if (hit < 0) return;
    const name = anatomyName(hit);
    const [chinese, english] = name.split(/\s*·\s*/);
    if (anatomyChinese.textContent !== chinese) anatomyChinese.textContent = chinese;
    if (anatomyEnglish.textContent !== english) anatomyEnglish.textContent = english;
    const left = Math.max(4, Math.min(hover.x + 14, width - anatomyLabel.offsetWidth - 4));
    const top = Math.max(4, Math.min(hover.y + 16, height - anatomyLabel.offsetHeight - 4));
    anatomyLabel.style.transform = 'translate(' + left + 'px, ' + top + 'px)';
  }

  function render(now) {
    const {clientWidth: width, clientHeight: height} = canvas;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const bw = Math.round(width * dpr), bh = Math.round(height * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform1f(uniforms.pixelRatio, dpr);
    const target = hover.active && !drag ? 1 : 0;
    const frameTime = Math.min(50, now - previousFrame);
    const ease = 1 - Math.exp(-frameTime / 95);
    previousFrame = now;
    hover.strength = reducedMotion.matches ? target : hover.strength + (target - hover.strength) * ease;
    gl.uniform2f(uniforms.cursor, hover.x - width / 2, height / 2 - hover.y);
    gl.uniform1f(uniforms.cursorStrength, hover.strength);
    const elapsed = (now - burst) / 1000;
    const motion = reducedMotion.matches ? 0 : now / 1000;
    gl.uniform1f(uniforms.time, motion);
    const soundPlaying = breathEnvelope && !breath.paused && !breath.ended;
    const breathTarget = soundPlaying ? breathExpansion() : 0;
    const breathEase = soundPlaying ? ease : 1 - Math.exp(-frameTime / 720);
    expansion += (breathTarget - expansion) * breathEase;
    if (reducedMotion.matches || (!soundPlaying && expansion < .003)) expansion = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
    gl.disableVertexAttribArray(toneLocation);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uniforms.flow, 3);
    gl.drawArrays(gl.POINTS, 0, BACKGROUND_POINTS);
    gl.uniform1f(uniforms.scatter, elapsed >= 0 && elapsed < 1.55 ? 1.1 * Math.sin(Math.PI * Math.pow(elapsed / 1.55, .48)) : 0);
    const i = active;
    const scale = Math.min(width,height) * .72 * zoom;
    gl.uniform2f(uniforms.offset, 0, 0);
    gl.uniform2f(uniforms.orbit, yaw, pitch);
    const modelScale = scale * (1 + expansion * .024);
    gl.uniform1f(uniforms.size, modelScale);
    updateAnatomyLabel(width, height, modelScale);
    gl.uniform1f(uniforms.inflation, expansion);
    const [left,bottom,right,top] = bounds[i];
    gl.uniform2f(uniforms.inflationRadii, Math.max(-left,right), Math.max(-bottom,top));
    gl.uniform1f(uniforms.seed, i * 36.7);
    gl.bindBuffer(gl.ARRAY_BUFFER, modelBuffer);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(toneLocation);
    gl.vertexAttribPointer(toneLocation, 1, gl.FLOAT, false, 16, 12);
    gl.uniform1f(uniforms.flow, 0);
    gl.drawArrays(gl.POINTS, i * POINTS, POINTS);
    // Write the surface depth before drawing the path, leaving model color unchanged.
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.colorMask(false, false, false, false);
    gl.uniform1f(uniforms.flow, 2);
    gl.drawArrays(gl.POINTS, i * POINTS, POINTS);
    gl.colorMask(true, true, true, true);
    traceTrail(trailPaths[i], bounds[i], motion, trail, i === 2 ? thirdTrailDepth : null);
    gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, trail, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(toneLocation);
    gl.vertexAttrib1f(toneLocation, 1);
    gl.uniform1f(uniforms.flow, 1);
    gl.drawArrays(gl.POINTS, 0, TRAIL_POINTS);
    gl.disable(gl.DEPTH_TEST);
    frame = requestAnimationFrame(render);
  }
  function scatter() { burst = performance.now(); }
  function adjustZoom(factor) { zoom = Math.min(2.4, Math.max(.55, zoom * factor)); }
  for (const button of modelButtons) {
    button.addEventListener('click', () => {
      active = Number(button.dataset.model);
      for (const item of modelButtons) item.setAttribute('aria-pressed', String(item === button));
      zoom = 1;
      if (!reducedMotion.matches) scatter();
    });
  }
  resetButton.addEventListener('click', () => { yaw = pitch = 0; zoom = 1; burst = -Infinity; });
  canvas.addEventListener('pointerdown', event => {
    if (drag) return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      const bounds = canvas.getBoundingClientRect();
      hover.x = event.clientX - bounds.left;
      hover.y = event.clientY - bounds.top;
      hover.active = hover.x >= 0 && hover.x < bounds.width && hover.y >= 0 && hover.y < bounds.height;
    }
    if (drag?.id !== event.pointerId) return;
    yaw += (event.clientX - drag.x) * .008;
    pitch += (event.clientY - drag.y) * .008;
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('pointerleave', () => { hover.active = false; });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    adjustZoom(Math.exp(-event.deltaY * .001));
  }, {passive:false});
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && (event.target === document.body || event.target === canvas)) {
      event.preventDefault();
      scatter();
    }
  });
  canvas.addEventListener('keydown', event => {
    const commands = {
      ArrowLeft: () => { yaw -= .16; }, ArrowRight: () => { yaw += .16; },
      ArrowUp: () => { pitch -= .16; }, ArrowDown: () => { pitch += .16; },
      '+': () => adjustZoom(1.12), '-': () => adjustZoom(1 / 1.12),
    };
    if (!Object.hasOwn(commands,event.key)) return;
    event.preventDefault();
    commands[event.key]();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    showFallback();
  });
  fetch('breath-envelope.json')
    .then(response => {
      if (!response.ok) throw Error('Sound timing unavailable');
      return response.json();
    })
    .then(samples => {
      if (!Array.isArray(samples) || samples.length < 2) throw Error('Invalid sound timing');
      breathEnvelope = samples;
      soundButton.disabled = false;
    })
    .catch(() => { soundButton.textContent = 'Ventilator unavailable'; });
  canvas.hidden = false;
  fallback.hidden = status.hidden = true;
  for (const button of [...modelButtons,resetButton]) button.disabled = false;
  frame = requestAnimationFrame(render);
}
function showFallback() {
  anatomyLabel.hidden = true;
  canvas.hidden = true;
  fallback.hidden = status.hidden = false;
  status.textContent = 'Interactive view unavailable · showing reference image';
  for (const button of [...modelButtons,resetButton]) button.disabled = true;
}
start().catch(showFallback);
