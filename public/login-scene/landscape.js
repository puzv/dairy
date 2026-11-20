(() => {
  const canvas = document.querySelector('#painting');
  const toggle = document.querySelector('#motionToggle');
  const text = toggle.querySelector('.motion-toggle__text');
  const status = document.querySelector('#motionStatus');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const SLOW_FRAME_MS = 28;
  const SLOW_STREAK = 2;
  const FAST_STREAK = 12;
  let playing = !motion.matches;
  let time = 0;
  let last = null;
  let frame = 0;
  let slow = canvas.dataset.slow === 'true';
  let slowFrames = 0;
  let fastFrames = 0;
  let draw;
  function noteFrame(delta) {
    if (delta > SLOW_FRAME_MS) {
      fastFrames = 0;
      slowFrames += 1;
      if (!slow && slowFrames >= SLOW_STREAK) {
        slow = true;
        canvas.dataset.slow = 'true';
      }
      return;
    }
    slowFrames = 0;
    if (!slow) {
      fastFrames = 0;
      return;
    }
    fastFrames += 1;
    if (fastFrames >= FAST_STREAK) {
      slow = false;
      fastFrames = 0;
      delete canvas.dataset.slow;
    }
  }
  function tick(now) {
    frame = 0;
    if (last !== null) {
      const delta = now - last;
      time += delta / 1000;
      noteFrame(delta);
    }
    last = now;
    draw(time);
    schedule();
  }
  function schedule() {
    if (playing && !document.hidden && draw && !frame) frame = requestAnimationFrame(tick);
  }
  function resetClock() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = null;
    schedule();
  }
  function changePlaying(value) {
    playing = value;
    toggle.dataset.state = value ? 'playing' : 'paused';
    toggle.setAttribute('aria-label', value ? '暂停动效' : '播放动效');
    text.textContent = value ? '暂停' : '继续';
    resetClock();
  }
  toggle.addEventListener('click', () => changePlaying(!playing));
  motion.addEventListener('change', e => { if (e.matches) changePlaying(false); });
  document.addEventListener('visibilitychange', resetClock);
  function fallback() {
    playing = false;
    resetClock();
    canvas.hidden = true;
    canvas.style.display = 'none';
    toggle.style.display = 'none';
    status.textContent = '当前显示静态山水。';
  }
  function loadTexture(gl, program, name, source, index) {
    return new Promise((resolve,reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error(source));
      image.onload = () => {
        try {
          gl.activeTexture(gl.TEXTURE0 + index);
          gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          for (const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
          for (const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);
          gl.uniform1i(gl.getUniformLocation(program,name),index);
          resolve();
        } catch(error) { reject(error); }
      };
      image.src = source;
    });
  }
  async function setup() {
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false});
    if (!gl) {fallback();return;}
    canvas.addEventListener('webglcontextlost',fallback);
    const program=gl.createProgram();
    function attach(type,source){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
    }
    attach(gl.VERTEX_SHADER,'attribute vec2 pos; varying vec2 vUV; void main(){vUV=vec2(pos.x*.5+.5,.5-pos.y*.5);gl_Position=vec4(pos,0.,1.);}');
    attach(gl.FRAGMENT_SHADER,window.landscapeFragment);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'pos');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const textures=[
      ['uBase','layers/plate.webp'],['uArt','day.webp'],
      ['uMasks','layers/motion-masks.png'],['uCloud','layers/cloud-panorama.png'],['uMist','layers/valley-mist.png']
    ];
    await Promise.all(textures.map(([name,src],i)=>loadTexture(gl,program,name,src,i)));
    const size=gl.getUniformLocation(program,'uSize'),clock=gl.getUniformLocation(program,'uTime');
    draw=t=>{gl.uniform1f(clock,t);gl.drawArrays(gl.TRIANGLES,0,3);};
    let widthLimit = 2560;
    function resize(){
      const scale=Math.min(devicePixelRatio,1.5,widthLimit/innerWidth);
      const width=Math.round(innerWidth*scale),height=Math.round(innerHeight*scale);
      if (canvas.width === width && canvas.height === height) return;
      canvas.width=width;canvas.height=height;
      gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(size,canvas.width,canvas.height);
      draw(time);
    }
    window.addEventListener('resize',resize);
    canvas.addEventListener('landscape-width', event => {
      widthLimit = event.detail;
      resize();
    });
    resize();canvas.style.visibility='visible';
    canvas.dataset.ready='true';
    changePlaying(playing);
  }
  canvas.style.visibility='hidden';
  setup().catch(e=>{console.error(e);fallback();});
})();
