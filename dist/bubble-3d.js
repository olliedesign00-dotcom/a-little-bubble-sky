'use strict';

// Closed 3D surfaces with smooth normals; the scene keeps its existing controls.
function bubbleOutlineRadius(type) {
  const outline = [];
  if (type === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .51 : 1;
      outline.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  } else if (type === 'heart') {
    const curves = [
      [[0, 1], [-.35, .68], [-1.2, .02], [-.94, -.57]],
      [[-.94, -.57], [-.72, -1.13], [-.2, -1.05], [0, -.58]],
      [[0, -.58], [.2, -1.05], [.72, -1.13], [.94, -.57]],
      [[.94, -.57], [1.2, .02], [.35, .68], [0, 1]],
    ];
    for (const c of curves) for (let i = 0; i < 32; i++) {
      const t = i / 32, u = 1 - t;
      outline.push([0, 1].map(k => u ** 3 * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t ** 3 * c[3][k]));
    }
  }
  const radiusAt = angle => {
    if (!outline.length) return 1;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let radius = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], det = dx * ey - dy * ex;
      if (Math.abs(det) < 1e-8) continue;
      const distance = (a[0] * ey - a[1] * ex) / det;
      const along = (a[0] * dy - a[1] * dx) / det;
      if (distance > 0 && along >= 0 && along <= 1) radius = Math.min(radius, distance);
    }
    return Number.isFinite(radius) ? radius : 1;
  };
  return radiusAt;
}

function bubbleMesh(type, latitudes = 32, longitudes = 64) {
  const radiusAt = bubbleOutlineRadius(type);
  const vertices = [], indices = [], normals = [];
  const radii = Array.from({length: longitudes + 1}, (_, j) => radiusAt(j / longitudes * Math.PI * 2));
  for (let i = 0; i <= latitudes; i++) {
    const phi = i / latitudes * Math.PI;
    for (let j = 0; j <= longitudes; j++) {
      const theta = j / longitudes * Math.PI * 2, radial = Math.sin(phi) * radii[j];
      vertices.push(radial * Math.cos(theta), -radial * Math.sin(theta), Math.cos(phi) * (type === 'round' ? 1 : .58));
      normals.push(0, 0, 0);
    }
  }
  for (let i = 0; i < latitudes; i++) for (let j = 0; j < longitudes; j++) {
    const a = i * (longitudes + 1) + j, b = a + longitudes + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3).map(n => n * 3), [a, b, c] = ids;
    const u = [0, 1, 2].map(k => vertices[b + k] - vertices[a + k]);
    const v = [0, 1, 2].map(k => vertices[c + k] - vertices[a + k]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    for (const id of ids) for (let k = 0; k < 3; k++) normals[id + k] += n[k];
  }
  // Weld the longitude seam and the shared pole vertices before normalizing.
  for (let i = 0; i <= latitudes; i++) {
    const a = i * (longitudes + 1) * 3, b = (i * (longitudes + 1) + longitudes) * 3;
    for (let k = 0; k < 3; k++) normals[a + k] = normals[b + k] = normals[a + k] + normals[b + k];
  }
  for (let i = 0; i < normals.length; i += 3) {
    const pole = i / 3 < longitudes + 1 ? 1 : i / 3 >= latitudes * (longitudes + 1) ? -1 : 0;
    if (pole) { normals[i] = normals[i + 1] = 0; normals[i + 2] = pole; }
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[i + k] /= length;
  }
  return {vertices: new Float32Array(vertices), normals: new Float32Array(normals), indices: new Uint16Array(indices)};
}

const attachmentOutlines = new Map(), attachmentTemplates = new Map();
function attachedBubbleMesh(b, rows = 40, columns = 64) {
  const attachment = b.motion.attachment;
  if (!attachmentOutlines.has(b.type)) attachmentOutlines.set(b.type,bubbleOutlineRadius(b.type));
  const boundary = attachmentOutlines.get(b.type);
  const key=b.type+':'+rows+':'+columns;
  if(!attachmentTemplates.has(key)){
    const points=[],rings=[];
    for(let j=0;j<=columns;j++)rings.push(boundary(j/columns*Math.PI*2));
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
      const phi=i/rows*Math.PI,theta=j/columns*Math.PI*2,x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),outline=boundary(Math.atan2(-y,x));
      points.push(x*outline,y*outline,Math.sin(phi)*Math.sin(theta)*(b.type==='round'?1:.58));
    }
    attachmentTemplates.set(key,{points,rings});
  }
  const template=attachmentTemplates.get(key);
  const limit = n => Math.max(0,Math.min(1,n));
  const smooth = n => {n=limit(n);return n*n*(3-2*n)};
  const amount = limit(attachment.amount ?? 1), growth = limit(attachment.growth ?? 1), pinch = limit(attachment.pinch || 0);
  const ax = (attachment.x-b.x)/b.r, ay = (b.y-attachment.y)/b.r;
  const mouth = Math.max(0,attachment.r-.6)/b.r;
  const scale = b.motion.scale || [1,1,1], tilt = b.motion.tilt ?? 1;
  const tx=Math.sin(b.seed*.73)*.10*tilt, ty=Math.sin(b.seed*.51)*.18*tilt;
  const cx=Math.cos(tx),sx=Math.sin(tx),cy=Math.cos(ty),sy=Math.sin(ty);
  const vertices=[],normals=[],indices=[],filmRadius=[];
  for(let i=0;i<=rows;i++) {
    const v=i/rows,phi=v*Math.PI,section=Math.sin(phi),vertical=Math.cos(phi);
    const neck=smooth((v-.64)/.36);
    for(let j=0;j<=columns;j++) {
      const theta=j/columns*Math.PI*2,c=Math.cos(theta),sn=Math.sin(theta);
      const at=(i*(columns+1)+j)*3;
      let x=template.points[at]*scale[0],y=template.points[at+1]*scale[1],z=template.points[at+2]*scale[2];
      const rotatedY=cx*y-sx*z,rotatedZ=sx*y+cx*z;
      const sphere=[cy*x+sy*rotatedZ,rotatedY,-sy*x+cy*rotatedZ];
      // One open cap: its boundary is the wand aperture, with no separate overlay.
      const ring=template.rings[j],rimX=mouth*ring*c,rimY=-mouth*ring*sn;
      const closure=1-smooth((pinch-.4)/.6);
      const root=[ax+rimX*closure,ay+rimY*closure,0];
      const stretched=sphere.map((value,k)=>value*(1-neck)+root[k]*neck);
      const waist=.87*pinch*Math.exp(-(((v-.84)/.075)**2));
      const center=[ax*neck, sphere[1]*(1-neck)+ay*neck,0];
      stretched[0]=center[0]+(stretched[0]-center[0])*(1-waist);
      stretched[2]*=1-waist;
      const sheet=[ax+v*rimX,ay+v*rimY,.008*(1-v*v)*Math.sin(v*4+b.seed*.65)];
      for(let k=0;k<3;k++) vertices.push(sphere[k]*(1-amount)+(sheet[k]*(1-growth)+stretched[k]*growth)*amount);
      normals.push(0,0,0);filmRadius.push(v);
    }
  }
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
    const a=i*(columns+1)+j,d=a+columns+1;indices.push(a,a+1,d,a+1,d+1,d);
  }
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const ux=vertices[b]-vertices[a],uy=vertices[b+1]-vertices[a+1],uz=vertices[b+2]-vertices[a+2];
    const vx=vertices[c]-vertices[a],vy=vertices[c+1]-vertices[a+1],vz=vertices[c+2]-vertices[a+2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
    for(const at of [a,b,c])for(let k=0;k<3;k++)normals[at+k]+=n[k];
  }
  // Shared normals make the longitudinal seam and cap center invisible.
  for(let i=0;i<=rows;i++){
    const a=i*(columns+1)*3,b=(i*(columns+1)+columns)*3;
    for(let k=0;k<3;k++)normals[a+k]=normals[b+k]=normals[a+k]+normals[b+k];
  }
  const pole=[0,0,0];for(let j=0;j<=columns;j++)for(let k=0;k<3;k++)pole[k]+=normals[j*3+k];
  for(let j=0;j<=columns;j++)for(let k=0;k<3;k++)normals[j*3+k]=pole[k];
  for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length<1e-8){normals[i]=0;normals[i+1]=0;normals[i+2]=1}else for(let k=0;k<3;k++)normals[i+k]/=length}
  return {vertices:new Float32Array(vertices),normals:new Float32Array(normals),indices:new Uint16Array(indices),filmRadius:new Float32Array(filmRadius)};
}

class BubbleRenderer {
  constructor(canvas, skyUrl) {
    this.canvas = canvas;
    this.ready = false;
    this.queue = [];
    this.gl = canvas.getContext('webgl', {alpha: true, antialias: true, premultipliedAlpha: true});
    if (!this.gl) return;
    this.sky = new Image();
    this.sky.onload = () => { if (this.ready) this.uploadSky(); };
    this.sky.src = skyUrl;
    canvas.addEventListener('webglcontextlost', event => {event.preventDefault(); this.ready = false; canvas.style.visibility = 'hidden';});
    canvas.addEventListener('webglcontextrestored', () => this.initialize());
    this.initialize();
  }
  initialize() {
    const gl = this.gl;
    try {
      const compile = (type, source) => {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute float aFilmRadius;
        uniform float uCustom;
        uniform vec2 uCenter;
        uniform vec2 uRadius;
        uniform vec2 uTilt;
        uniform vec3 uDeform;
        uniform mediump float uFilm;
        uniform float uFilmDepth;
        uniform mediump float uTime;
        varying mediump float vFilmRadius;
        varying mediump vec3 vNormal;
        varying mediump vec3 vPosition;
        void main() {
          float cx = cos(uTilt.x), sx = sin(uTilt.x), cy = cos(uTilt.y), sy = sin(uTilt.y);
          mat3 rotateX = mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx);
          mat3 rotateY = mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
          mat3 rotation = rotateY * rotateX;
          // The membrane is pinned at its perimeter and only ripples in its interior.
          float pole = aPosition.z / uFilmDepth;
          vFilmRadius = sqrt(max(0., 1. - pole*pole));
          float envelope = pole*pole;
          float phase = uTime*.65;
          float ripple = .008 * envelope * sin(aPosition.x*4. + phase) * cos(aPosition.y*3. - phase*.7);
          vec3 sheet = vec3(aPosition.xy * uDeform.xy, ripple);
          vec3 sheetNormal = normalize(vec3(-.025*envelope*cos(aPosition.x*4.+phase), .02*envelope*sin(aPosition.y*3.-phase*.7), 1.));
          vec3 p = rotation * mix(aPosition * uDeform, sheet, uFilm);
          vNormal = rotation * mix(normalize(aNormal / uDeform), sheetNormal, uFilm);
          if(uCustom>.5){p=aPosition;vNormal=aNormal;vFilmRadius=aFilmRadius;}
          vPosition = p;
          float perspective = 5.0 / (5.0 - p.z * .38);
          gl_Position = vec4(uCenter + p.xy * uRadius * perspective, -p.z * .1, 1.0);
        }
      `);
      const fragment = compile(gl.FRAGMENT_SHADER, `
        precision mediump float;
        uniform sampler2D uSky;
        uniform mediump float uTime;
        uniform float uAlpha;
        uniform vec4 uRupture;
        uniform mediump float uFilm;
        varying mediump float vFilmRadius;
        varying mediump vec3 vNormal;
        varying mediump vec3 vPosition;
        void main() {
          float tornEdge = 0.;
          if(uRupture.z >= 0.) {
            float opening = distance(gl_FragCoord.xy,uRupture.xy)-uRupture.z;
            if(opening < 0.) discard;
            tornEdge = 1.-smoothstep(0.,uRupture.w,opening);
          }
          vec3 n = normalize(vNormal);
          vec3 view = normalize(vec3(0.,0.,5.) - vPosition * .38);
          float facing = max(dot(n,view), 0.);
          float fresnel = .035 + .965 * pow(1. - facing, 3.0);
          vec3 reflection = reflect(-view,n);
          vec2 uv = clamp(vec2(.5 + reflection.x*.46, .5 + reflection.y*.46), .005, .995);
          vec3 environment = texture2D(uSky, uv).rgb;
          // Wavelength-dependent interference through a slowly moving soap film.
          float thickness = 460. + 75.*sin(vPosition.y*3.4 + uTime*.48) + 38.*sin(vPosition.x*4. + uTime*.27);
          float opticalPath = 2. * 1.33 * thickness * sqrt(max(.1, 1. - (1.-facing*facing)/1.7689));
          vec3 interference = .5 + .5*cos(6.2831853 * opticalPath / vec3(650.,510.,475.));
          vec3 rainbow = mix(vec3(.76,.89,1.), interference, .76);
          vec3 light = normalize(vec3(-.48,.65,1.));
          float highlight = pow(max(dot(n,light),0.), 95.);
          float softbox = exp(-pow((n.x+.38)/.27,2.)-pow((n.y-.60)/.10,2.))*.6;
          float glint = pow(max(dot(n,normalize(vec3(.57,-.58,.55))),0.), 70.)*.52;
          float reflectedCloud = smoothstep(.69,.98,dot(environment,vec3(.2126,.7152,.0722)));
          float band = pow(1.-facing,1.8);
          vec3 color = mix(environment, rainbow, .40 + band*.32);
          color = mix(color,vec3(1.),clamp(highlight+softbox+glint+reflectedCloud*.28,0.,1.));
          float alpha = .055 + fresnel*.64 + band*.13 + reflectedCloud*.14 + highlight*.73 + softbox*.52 + glint*.35;
          // A wet, almost planar film has broad interference bands, not a sphere's rim glow.
          float field = -vPosition.y*1.8 + .20*sin(vPosition.x*4.+uTime*.42) + .10*sin(vPosition.y*7.-uTime*.23);
          float filmPath = 2.66 * (450. + 105.*field);
          vec3 filmInterference = .5 + .5*cos(6.2831853*filmPath/vec3(650.,510.,475.));
          vec3 filmColor = mix(vec3(.78,.91,1.), filmInterference, .56);
          float wetEdge = smoothstep(.93, .997, vFilmRadius);
          float pooling = clamp(.5-vPosition.y*.5,0.,1.);
          float reflectionStreak = exp(-pow((vPosition.x+.28)/.65,2.)-pow((vPosition.y-.38)/.19,2.));
          filmColor = mix(filmColor, vec3(.93,.98,1.), wetEdge*.40+reflectionStreak*.16);
          float filmAlpha = .17 + .065*sin(field*4.+uTime*.18) + wetEdge*(.30+pooling*.12) + reflectionStreak*.09;
          vec3 finalColor=mix(mix(color,filmColor,uFilm),vec3(.94,.99,1.),tornEdge*.75);
          float finalAlpha=max(mix(clamp(alpha,0.,.94),filmAlpha,uFilm),tornEdge*.68);
          gl_FragColor = vec4(finalColor,finalAlpha*uAlpha);
        }
      `);
      this.program = gl.createProgram();gl.attachShader(this.program,vertex);gl.attachShader(this.program,fragment);gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
      gl.deleteShader(vertex);gl.deleteShader(fragment);
      this.locations = {};
      for (const name of ['uCustom','uCenter','uRadius','uTilt','uDeform','uFilm','uFilmDepth','uSky','uTime','uAlpha','uRupture']) this.locations[name] = gl.getUniformLocation(this.program,name);
      this.filmRadius = gl.getAttribLocation(this.program,'aFilmRadius');
      this.dynamicMesh={};for(const name of ['vertices','normals','indices','filmRadius'])this.dynamicMesh[name]=gl.createBuffer();
      this.position = gl.getAttribLocation(this.program,'aPosition');this.normal = gl.getAttribLocation(this.program,'aNormal');
      this.meshes = {};
      for (const type of ['round','heart','star']) {
        const data = bubbleMesh(type), buffers = {};
        for (const name of ['vertices','normals','indices']) {
          const target = name === 'indices' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
          buffers[name] = gl.createBuffer(); gl.bindBuffer(target,buffers[name]);gl.bufferData(target,data[name],gl.STATIC_DRAW);
        }
        this.meshes[type] = {...buffers,count:data.indices.length};
      }
      this.texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([169,211,243,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.disable(gl.DEPTH_TEST);
      this.ready = true;this.canvas.style.visibility = '';
      if (this.sky.complete && this.sky.naturalWidth) this.uploadSky();
    } catch (error) {
      this.ready = false;this.canvas.style.visibility = 'hidden';console.warn('3D bubble renderer unavailable; using the canvas fallback.',error);
    }
  }
  uploadSky() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.sky);
  }
  begin(width,height) {
    this.width = width;this.height = height;this.queue.length = 0;
    const dpr = Math.min(devicePixelRatio, 2), w = Math.round(width*dpr), h = Math.round(height*dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {this.canvas.width = w;this.canvas.height = h;}
  }
  add(x,y,r,seed,alpha,type,motion = {}) {this.queue.push({x,y,r,seed,alpha,type,motion});}
  render() {
    if (!this.ready) return;
    const gl = this.gl, u = this.locations;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(u.uSky,0);
    for (const b of this.queue) {
      const custom=!!b.motion.attachment;
      let mesh = this.meshes[b.type] || this.meshes.round;
      if(custom){
        const data=attachedBubbleMesh(b);mesh=this.dynamicMesh;mesh.count=data.indices.length;
        for(const name of ['vertices','normals','indices','filmRadius']){
          const target=name==='indices'?gl.ELEMENT_ARRAY_BUFFER:gl.ARRAY_BUFFER;
          gl.bindBuffer(target,mesh[name]);gl.bufferData(target,data[name],gl.DYNAMIC_DRAW);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.filmRadius);gl.enableVertexAttribArray(this.filmRadius);gl.vertexAttribPointer(this.filmRadius,1,gl.FLOAT,false,0,0);
      }else{gl.disableVertexAttribArray(this.filmRadius);gl.vertexAttrib1f(this.filmRadius,0)}
      gl.uniform1f(u.uCustom,custom?1:0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertices);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normals);gl.enableVertexAttribArray(this.normal);gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,0,0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
      gl.uniform2f(u.uCenter,b.x/this.width*2-1,1-b.y/this.height*2);gl.uniform2f(u.uRadius,b.r/this.width*2,b.r/this.height*2);
      const scale = b.motion.scale || [1,1,1], tilt = b.motion.tilt ?? 1;
      gl.uniform3f(u.uDeform,scale[0],scale[1],scale[2]);
      gl.uniform1f(u.uFilm,b.motion.film || 0);
      gl.uniform1f(u.uFilmDepth,b.type === 'heart' || b.type === 'star' ? .58 : 1);
      gl.uniform2f(u.uTilt,Math.sin(b.seed*.73)*.10*tilt,Math.sin(b.seed*.51)*.18*tilt);
      const rupture=b.motion.rupture,dpr=this.canvas.width/this.width;
      gl.uniform4f(u.uRupture,rupture?rupture.x*dpr:0,rupture?(this.height-rupture.y)*dpr:0,rupture?rupture.r*dpr:-1,1.5*dpr);
      gl.uniform1f(u.uTime,b.seed);gl.uniform1f(u.uAlpha,b.alpha);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
    }
  }
}
