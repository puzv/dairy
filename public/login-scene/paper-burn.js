/*
 * paper-burn.js — GPU overlay for the "点日开卷" transition.
 *
 *   const draw = window.createPaperBurn(canvas, duskImage, grainImage);
 *   draw(0.0); // transparent
 *   draw(0.5); // fibrous burn front revealing centered-cover dusk
 *   draw(1.0); // opaque dusk, pixel-aligned with background-size: cover
 *
 * The caller owns the canvas drawing-buffer size. This file has no state,
 * no DOM, no animation loop and no timers; draw(progress) is idempotent.
 */
(function () {
  'use strict';

  var VERTEX_SOURCE = [
    'attribute vec2 aPos;',
    'void main() {',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAGMENT_SOURCE = [
    'precision highp float;',
    '',
    'uniform vec2 uSize;',
    'uniform float uProgress;',
    'uniform sampler2D uDusk;',
    'uniform sampler2D uGrain;',
    '',
    'const vec2 SRC_SIZE = vec2(1672.0, 941.0);',
    'const vec2 IGNITION = vec2(1208.0, 259.0);',
    '',
    '// Top-left source coordinates, center-cover of the 1672 x 941 plate.',
    'vec2 sourcePixel() {',
    '  float cover = max(uSize.x / SRC_SIZE.x, uSize.y / SRC_SIZE.y);',
    '  vec2 drawn = SRC_SIZE * cover;',
    '  vec2 origin = (uSize - drawn) * 0.5;',
    '  vec2 frag = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);',
    '  return (frag - origin) / cover;',
    '}',
    '',
    'vec3 duskAt(vec2 p) {',
    '  vec2 uv = clamp(p, vec2(0.5), SRC_SIZE - vec2(0.5)) / SRC_SIZE;',
    '  return texture2D(uDusk, uv).rgb;',
    '}',
    '',
    'void main() {',
    '  vec2 p = sourcePixel();',
    '',
    '  // Exact final frame: no tint, no noise, no offset.',
    '  if (uProgress >= 0.9999) {',
    '    gl_FragColor = vec4(duskAt(p), 1.0);',
    '    return;',
    '  }',
    '',
    '  vec2 dp = p - IGNITION;',
    '  float radius = length(dp);',
    '  float radiusSq = radius * radius;',
    '',
    '  // Baked grain uses the dusk source coordinates: R=paper, G=coarse, B=fibres.',
    '  vec3 grain = texture2D(uGrain, clamp(p, vec2(0.5), SRC_SIZE - vec2(0.5)) / SRC_SIZE).rgb;',
    '  float paper = grain.r;',
    '  float coarse = grain.g;',
    '  float fibres = grain.b;',
    '',
    '  // Static arrival field. A pixel burns when the front passes its value.',
    '  float base = length(dp * vec2(0.96, 1.12)) / 1500.0;',
    '  float roughness = (coarse - 0.5) * 0.21 + (paper - 0.5) * 0.12 + (fibres - 0.5) * 0.028;',
    '  float field = base + roughness * smoothstep(0.0, 100.0, radius);',
    '',
    '  float burn = clamp(uProgress, 0.0, 1.0);',
    '  float front = -0.008 + 1.08 * pow(burn, 1.45);',
    '  float x = front - field;',
    '',
    '  // Outside every edge term. Spark is exactly gone by 0.18, or negligible far away.',
    '  if (x <= -0.02 && (burn >= 0.18 || radiusSq >= 10000.0)) {',
    '    gl_FragColor = vec4(0.0);',
    '    return;',
    '  }',
    '',
    '  // Past the thread cutoff and spark: exact opaque dusk, no edge colors.',
    '  if (x >= 0.12 && (burn >= 0.18 || radiusSq >= 10000.0)) {',
    '    gl_FragColor = vec4(duskAt(p), 1.0);',
    '    return;',
    '  }',
    '',
    '  // Warm paper scorch, only ahead of the charred threshold.',
    '  float pre = smoothstep(-0.014, -0.002, x) * (1.0 - smoothstep(-0.001, 0.006, x));',
    '  float mottle = smoothstep(0.28, 0.78, paper);',
    '  float preA = pre * (0.13 + 0.19 * mottle);',
    '',
    '  // Soft dark char band; it cools and fades as the opening completes.',
    '  float charLife = 1.0 - smoothstep(0.70, 0.965, burn);',
    '  float charBand = smoothstep(-0.006, 0.001, x) * (1.0 - smoothstep(0.004, 0.012, x));',
    '  float charA = charBand * charLife * (0.62 + 0.30 * fibres);',
    '',
    '  // The dusk opening lags the front by a breath so the lip stays narrow.',
    '  float reveal = smoothstep(0.001, 0.004, x);',
    '',
    '  // Narrow golden lip, then a wider ember that cools first.',
    '  float lipLife = 1.0 - smoothstep(0.66, 0.95, burn);',
    '  float lipU = (x - 0.003) / 0.0023;',
    '  float lip = exp(-lipU * lipU);',
    '  lip *= lipLife * (0.62 + 0.38 * smoothstep(0.52, 0.80, fibres));',
    '  float emberCool = 1.0 - smoothstep(0.42, 0.90, burn);',
    '  float emberBand = smoothstep(-0.008, 0.005, x) * (1.0 - smoothstep(0.018, 0.085, x));',
    '  float ember = emberBand * emberCool * (0.45 + 0.55 * mottle) * 0.5;',
    '',
    '  // A few fine fibers hang from the rim for a moment, then let go.',
    '  float thread = smoothstep(0.58, 0.82, fibres)',
    '               * smoothstep(-0.002, 0.006, x)',
    '               * (1.0 - smoothstep(0.030, 0.110, x))',
    '               * (1.0 - smoothstep(0.52, 0.86, burn));',
    '',
    '  vec3 dusk = duskAt(p);',
    '  vec3 charCol = vec3(0.045, 0.022, 0.011);',
    '  vec3 singeCol = vec3(0.56, 0.245, 0.070);',
    '  vec3 emberCol = vec3(1.0, 0.31, 0.045);',
    '  vec3 goldCol = vec3(1.0, 0.68, 0.24);',
    '',
    '  float charShade = clamp(thread * 0.62 + charBand * charLife * 0.35, 0.0, 0.78);',
    '  vec3 openCol = mix(dusk, charCol, charShade);',
    '  openCol += emberCol * (lip * 0.52 + ember * 0.32);',
    '  openCol = mix(openCol, goldCol, lip * 0.30);',
    '',
    '  // Straight-alpha layering: singe -> char -> dusk -> hot rim.',
    '  vec3 premul = singeCol * preA;',
    '  float alpha = preA;',
    '  premul = charCol * charA + premul * (1.0 - charA);',
    '  alpha = charA + alpha * (1.0 - charA);',
    '  premul = openCol * reveal + premul * (1.0 - reveal);',
    '  alpha = reveal + alpha * (1.0 - reveal);',
    '',
    '  // The first instant: one tiny, warm, stationary glowing speck.',
    '  float spark = exp(-radiusSq / 110.0)',
    '              * smoothstep(0.0, 0.025, burn)',
    '              * (1.0 - smoothstep(0.050, 0.180, burn));',
    '  premul += vec3(1.0, 0.52, 0.14) * spark * 0.9;',
    '  alpha = min(1.0, alpha + spark * 0.7);',
    '',
    '  float glow = lip * 0.20 + ember * 0.12;',
    '  premul += goldCol * glow;',
    '  alpha = min(1.0, alpha + glow * 0.5);',
    '',
    '  if (alpha < 0.001) {',
    '    gl_FragColor = vec4(0.0);',
    '    return;',
    '  }',
    '  gl_FragColor = vec4(premul / max(alpha, 0.001), alpha);',
    '}'
  ].join('\n');

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) {
      throw new Error('paper-burn: could not create shader');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader) || 'unknown shader error';
      gl.deleteShader(shader);
      throw new Error('paper-burn shader compile failed: ' + log);
    }
    return shader;
  }

  function uploadImageTexture(gl, unit, image) {
    var texture = gl.createTexture();
    if (!texture) {
      throw new Error('paper-burn: could not create texture');
    }
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    } catch {
      // Older contexts simply keep their default color conversion.
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    return texture;
  }

  function createPaperBurn(canvas, duskImage, grainImage) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('paper-burn: a canvas is required');
    }
    if (!duskImage || !duskImage.naturalWidth) {
      throw new Error('paper-burn: duskImage must be a decoded image');
    }
    if (!grainImage || !(grainImage.naturalWidth || grainImage.width)) {
      throw new Error('paper-burn: grainImage must be a decoded image');
    }

    var attributes = {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    };

    var gl = canvas.getContext('webgl', attributes) ||
             canvas.getContext('experimental-webgl', attributes);
    if (!gl) {
      throw new Error('paper-burn: WebGL is unavailable');
    }

    var vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    var fragmentShader;
    var program;
    try {
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
      program = gl.createProgram();
      if (!program) {
        throw new Error('paper-burn: could not create program');
      }
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var linkLog = gl.getProgramInfoLog(program) || 'unknown link error';
        throw new Error('paper-burn program link failed: ' + linkLog);
      }
    } catch (error) {
      if (program) {
        gl.deleteProgram(program);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
      gl.deleteShader(vertexShader);
      throw error;
    }

    // The linked program owns the compiled code now.
    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.useProgram(program);

    var positionLocation = gl.getAttribLocation(program, 'aPos');
    if (positionLocation < 0) {
      gl.deleteProgram(program);
      throw new Error('paper-burn: missing aPos attribute');
    }

    var sizeLocation = gl.getUniformLocation(program, 'uSize');
    var progressLocation = gl.getUniformLocation(program, 'uProgress');
    var duskLocation = gl.getUniformLocation(program, 'uDusk');
    var grainLocation = gl.getUniformLocation(program, 'uGrain');
    if (!sizeLocation || !progressLocation || !duskLocation || !grainLocation) {
      gl.deleteProgram(program);
      throw new Error('paper-burn: missing shader uniform');
    }

    var buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      throw new Error('paper-burn: could not create buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    var duskTexture;
    var grainTexture;
    try {
      duskTexture = uploadImageTexture(gl, gl.TEXTURE0, duskImage);
      grainTexture = uploadImageTexture(gl, gl.TEXTURE1, grainImage);
    } catch (error) {
      if (duskTexture) {
        gl.deleteTexture(duskTexture);
      }
      if (grainTexture) {
        gl.deleteTexture(grainTexture);
      }
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      throw error;
    }
    gl.uniform1i(duskLocation, 0);
    gl.uniform1i(grainLocation, 1);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DITHER);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);

    var viewportWidth = -1;
    var viewportHeight = -1;

    return function draw(progress) {
      var value = Number(progress);
      if (!isFinite(value)) {
        value = 0;
      }
      value = Math.max(0, Math.min(1, value));

      var width = canvas.width;
      var height = canvas.height;
      if (width <= 0 || height <= 0) {
        return;
      }

      if (width !== viewportWidth || height !== viewportHeight) {
        gl.viewport(0, 0, width, height);
        viewportWidth = width;
        viewportHeight = height;
      }

      if (value <= 0) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      gl.uniform2f(sizeLocation, width, height);
      gl.uniform1f(progressLocation, value);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  window.createPaperBurn = createPaperBurn;
})();
