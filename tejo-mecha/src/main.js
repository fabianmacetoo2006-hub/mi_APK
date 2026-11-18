import './style.css'

// ====== Tejo Mecha ======
// Juego de tejo colombiano: apuntar → fuerza → lanzar.
// Mecha = 3, Embocinada = 6, Moñona (mecha + embocinada) = 9, Cerquita = 1.

const canvas = document.getElementById('juego')
const ctx = canvas.getContext('2d')
const $ = (id) => document.getElementById(id)
const ui = {
  hud: $('hud'), instruccion: $('instruccion'),
  puntos: $('puntos'), lanzamiento: $('lanzamiento'), viento: $('viento'),
  inicio: $('inicio'), fin: $('fin'), pausa: $('pausa'),
  recordInicio: $('recordInicio'), recordFin: $('recordFin'),
  puntosFin: $('puntosFin'), resumenFin: $('resumenFin'), tituloFin: $('tituloFin'),
  nuevoRecord: $('nuevoRecord'),
}

const TOTAL_TEJOS = 10

// ---------- Récord ----------
function leerRecord () { try { return Number(localStorage.getItem('tm_record')) || 0 } catch { return 0 } }
function guardarRecord (v) { try { localStorage.setItem('tm_record', String(v)) } catch {} }
let record = leerRecord()
ui.recordInicio.textContent = record

// ---------- Sonido (Web Audio, sin archivos) ----------
let audio = null
function ac () { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); return audio }
function tono (freq, dur = 0.1, tipo = 'square', vol = 0.07) {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain()
    o.type = tipo; o.frequency.value = freq; g.gain.value = vol
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur)
  } catch {}
}
function explosion (fuerte = 1) {
  try {
    const a = ac(), dur = 0.6
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 900
    g.gain.value = 0.5 * fuerte
    s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start()
  } catch {}
}
const golpe = () => tono(90, 0.15, 'sine', 0.25)
const vibrar = (ms) => { try { navigator.vibrate && navigator.vibrate(ms) } catch {} }

// ---------- Medidas de la cancha ----------
let W, H, cx, bocinY, R, cajaW, cajaH, lanzaY, maxDist, textura = []
function ajustar () {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const r = canvas.getBoundingClientRect()
  W = r.width; H = r.height
  canvas.width = W * dpr; canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  cx = W / 2
  bocinY = H * 0.3
  cajaW = Math.min(W * 0.78, 320)
  cajaH = cajaW * 0.85
  R = cajaW * 0.115
  lanzaY = H - 110
  maxDist = lanzaY - H * 0.06
  textura = []
  for (let i = 0; i < 140; i++) {
    textura.push({ x: (Math.random() - 0.5) * cajaW, y: (Math.random() - 0.5) * cajaH, r: Math.random() * 2.5 + 0.5, c: Math.random() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,220,180,.10)' })
  }
}
window.addEventListener('resize', ajustar)
ajustar()

const mechasPos = () => [{ x: cx - R, y: bocinY - 4 }, { x: cx + R, y: bocinY - 4 }]

// ---------- Estado ----------
let estado = 'menu' // menu | jugando | pausa | fin
let fase           // apuntar | fuerza | vuelo | resultado
let t = 0, angulo = 0, fuerza = 0, viento = 0, puntos = 0, tejo = null, numTejo = 1, mechas = null, marcas = [], particulas = [], popup = null, flash = 0, stats, espera = 0

function nuevoChico () {
  puntos = 0; numTejo = 1; marcas = []; particulas = []
  stats = { mechas: 0, embocinadas: 0, mononas: 0 }
  prepararTejo()
}

function prepararTejo () {
  fase = 'apuntar'
  t = 0; angulo = 0; fuerza = 0
  viento = Math.round((Math.random() * 2 - 1) * Math.min(1 + numTejo * 0.4, 4))
  mechas = mechasPos().map((m) => ({ ...m, viva: true }))
  tejo = null; popup = null; flash = 0
  actualizarHud()
  ui.instruccion.textContent = 'Toca para fijar la puntería'
}

function actualizarHud () {
  ui.puntos.textContent = puntos
  ui.lanzamiento.textContent = `${Math.min(numTejo, TOTAL_TEJOS)}/${TOTAL_TEJOS}`
  ui.viento.textContent = viento === 0 ? '—' : (viento > 0 ? '→ ' : '← ') + Math.abs(viento)
}

// ---------- Entrada ----------
function tocar () {
  if (estado !== 'jugando') return
  if (fase === 'apuntar') {
    fase = 'fuerza'; t = 0
    ui.instruccion.textContent = 'Toca para fijar la fuerza'
    tono(500, 0.06, 'triangle')
  } else if (fase === 'fuerza') {
    lanzar()
  }
}
canvas.addEventListener('pointerdown', tocar)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); tocar() }
  if (e.key === 'p' || e.key === 'Escape') alternarPausa()
})

function lanzar () {
  fase = 'vuelo'
  ui.instruccion.textContent = ''
  const d = fuerza * maxDist
  const deriva = viento * 9 * (d / maxDist) * 2
  tejo = {
    x0: cx, y0: lanzaY,
    x1: cx + Math.sin(angulo) * d + deriva,
    y1: lanzaY - Math.cos(angulo) * d,
    p: 0, dur: 0.55 + fuerza * 0.5,
  }
  tono(300, 0.12, 'sawtooth', 0.04)
}

function aterrizar () {
  const x = tejo.x1, y = tejo.y1
  marcas.push({ x, y })
  const dc = Math.hypot(x - cx, y - bocinY)
  const embocinada = dc < R - 5
  let mecha = false
  for (const m of mechas) {
    if (m.viva && Math.hypot(x - m.x, y - m.y) < 20) { m.viva = false; mecha = true; estallar(m.x, m.y) }
  }
  const dentroCaja = Math.abs(x - cx) < cajaW / 2 && Math.abs(y - bocinY) < cajaH / 2

  let pts = 0, texto, color = '#fff'
  if (embocinada && mecha) { pts = 9; texto = '¡MOÑONA!'; color = '#ff5a36'; stats.mononas++ }
  else if (embocinada) { pts = 6; texto = '¡Embocinada!'; color = '#7dff9e'; stats.embocinadas++ }
  else if (mecha) { pts = 3; texto = '¡Mecha!'; color = '#fcd116'; stats.mechas++ }
  else if (dc < R * 2.3) { pts = 1; texto = 'Cerquita'; color = '#e9c79a' }
  else if (dentroCaja) { texto = 'En la greda… nada' }
  else { texto = '¡Fuera de la caja!' }

  if (mecha) { explosion(embocinada ? 1.4 : 1); vibrar(embocinada ? [80, 60, 160] : 120); flash = 1 }
  else golpe()
  if (embocinada && !mecha) { tono(660, 0.1, 'triangle'); setTimeout(() => tono(990, 0.15, 'triangle'), 90) }

  puntos += pts
  popup = { texto, pts, color, vida: 1.4 }
  fase = 'resultado'
  espera = 1.5
  actualizarHud()
}

function estallar (x, y) {
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 260
    particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.5 + Math.random() * 0.5, c: Math.random() < 0.5 ? '#ffd23f' : '#ff5a1f', r: 2 + Math.random() * 3 })
  }
  for (let i = 0; i < 10; i++) {
    particulas.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, vida: 1.2, c: 'rgba(120,120,120,.6)', r: 6 + Math.random() * 8, humo: true })
  }
}

// ---------- Pantallas ----------
function mostrar (p) {
  for (const s of [ui.inicio, ui.fin, ui.pausa]) s.classList.add('oculto')
  if (p) p.classList.remove('oculto')
  const enJuego = estado === 'jugando' || estado === 'pausa'
  ui.hud.classList.toggle('oculto', !enJuego)
  ui.instruccion.classList.toggle('oculto', !enJuego)
}
function jugar () { ajustar(); nuevoChico(); estado = 'jugando'; mostrar(null); tono(660, 0.1, 'triangle') }
function alternarPausa () {
  if (estado === 'jugando') { estado = 'pausa'; mostrar(ui.pausa) }
  else if (estado === 'pausa') { estado = 'jugando'; mostrar(null) }
}
function terminar () {
  estado = 'fin'
  ui.puntosFin.textContent = puntos
  ui.resumenFin.textContent = `💥 ${stats.mechas} mechas · 🎯 ${stats.embocinadas} embocinadas · 🔥 ${stats.mononas} moñonas`
  ui.tituloFin.textContent =
    puntos >= 45 ? '¡Maestro del tejo! 🏆' :
    puntos >= 25 ? 'Buen brazo, parcero 💪' :
    puntos >= 10 ? 'Vas bien, falta práctica' : '¡Pura greda! 😅'
  const nuevo = puntos > record
  if (nuevo) { record = puntos; guardarRecord(record) }
  ui.recordFin.textContent = record; ui.recordInicio.textContent = record
  ui.nuevoRecord.classList.toggle('oculto', !nuevo)
  mostrar(ui.fin)
}
$('btnJugar').onclick = jugar
$('btnOtraVez').onclick = jugar
$('btnMenu').onclick = () => { estado = 'menu'; mostrar(ui.inicio) }
$('btnPausa').onclick = alternarPausa
$('btnSeguir').onclick = alternarPausa
$('btnSalir').onclick = () => { estado = 'menu'; mostrar(ui.inicio) }
document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando') alternarPausa() })

// ---------- Lógica ----------
function actualizar (dt) {
  t += dt
  const dificultad = 1 + (numTejo - 1) * 0.08
  if (fase === 'apuntar') angulo = Math.sin(t * 2.2 * dificultad) * 0.32
  if (fase === 'fuerza') {
    const ciclo = (t * 0.75 * dificultad) % 2
    fuerza = ciclo < 1 ? ciclo : 2 - ciclo
  }
  if (fase === 'vuelo') {
    tejo.p += dt / tejo.dur
    if (tejo.p >= 1) { tejo.p = 1; aterrizar() }
  }
  if (fase === 'resultado') {
    espera -= dt
    if (espera <= 0) {
      numTejo++
      if (numTejo > TOTAL_TEJOS) { terminar(); return }
      prepararTejo()
    }
  }
  for (const p of particulas) {
    p.x += p.vx * dt; p.y += p.vy * dt
    if (!p.humo) { p.vx *= 0.92; p.vy *= 0.92 } else p.r += dt * 10
    p.vida -= dt
  }
  particulas = particulas.filter((p) => p.vida > 0)
  if (popup) popup.vida -= dt
  flash = Math.max(0, flash - dt * 3)
}

// ---------- Dibujo ----------
function rr (x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function dibujarCancha () {
  // Fondo: tierra y pasto
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#3e5c2e'); g.addColorStop(1, '#2d4422')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // Pasillo de tierra
  ctx.fillStyle = '#a07650'
  ctx.fillRect(cx - cajaW / 2 - 14, 0, cajaW + 28, H)
  ctx.fillStyle = 'rgba(0,0,0,.08)'
  for (let y = 0; y < H; y += 28) ctx.fillRect(cx - cajaW / 2 - 14, y, cajaW + 28, 2)
  // Línea de lanzamiento
  ctx.fillStyle = '#f3e2c7'
  ctx.fillRect(cx - cajaW / 2 - 14, lanzaY + 26, cajaW + 28, 5)

  // Caja de greda con marco de madera
  const x0 = cx - cajaW / 2, y0 = bocinY - cajaH / 2
  ctx.fillStyle = '#5b3518'; rr(x0 - 12, y0 - 12, cajaW + 24, cajaH + 24, 8); ctx.fill()
  ctx.fillStyle = '#7a4a26'; rr(x0 - 6, y0 - 6, cajaW + 12, cajaH + 12, 6); ctx.fill()
  const gg = ctx.createRadialGradient(cx, bocinY, 10, cx, bocinY, cajaW * 0.7)
  gg.addColorStop(0, '#9a6a47'); gg.addColorStop(1, '#6b4128')
  ctx.fillStyle = gg; ctx.fillRect(x0, y0, cajaW, cajaH)
  for (const p of textura) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(cx + p.x, bocinY + p.y, p.r, 0, Math.PI * 2); ctx.fill() }

  // Marcas de tejos anteriores
  for (const m of marcas) {
    ctx.fillStyle = 'rgba(40,25,15,.45)'
    ctx.beginPath(); ctx.ellipse(m.x, m.y, 13, 9, 0, 0, Math.PI * 2); ctx.fill()
  }

  // Bocín
  ctx.fillStyle = '#3a2214'
  ctx.beginPath(); ctx.arc(cx, bocinY, R, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#2b2b2e'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.arc(cx, bocinY, R, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#8d8f96'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, bocinY, R + 1, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke()

  // Mechas
  for (const m of mechas || mechasPos().map((p) => ({ ...p, viva: true }))) {
    if (m.viva) {
      ctx.save(); ctx.translate(m.x, m.y)
      ctx.fillStyle = '#f7f3ea'
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 6); ctx.lineTo(-13, 6); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#c9c1b0'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = '#e23b3b'
      ctx.beginPath(); ctx.arc(0, -3, 4, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(20,10,5,.7)'
      ctx.beginPath(); ctx.arc(m.x, m.y, 16, 0, Math.PI * 2); ctx.fill()
    }
  }
}

function dibujarTejo (x, y, escala = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(escala, escala)
  const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15)
  g.addColorStop(0, '#e6e8ec'); g.addColorStop(0.5, '#9a9ea8'); g.addColorStop(1, '#4a4d55')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#33353b'; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
}

function dibujarControles () {
  if (fase === 'apuntar' || fase === 'fuerza') {
    // Línea de puntería
    ctx.save(); ctx.translate(cx, lanzaY); ctx.rotate(angulo)
    ctx.strokeStyle = fase === 'apuntar' ? '#fff' : 'rgba(255,255,255,.55)'
    ctx.lineWidth = 3; ctx.setLineDash([8, 8])
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -140); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = ctx.strokeStyle
    ctx.beginPath(); ctx.moveTo(0, -156); ctx.lineTo(9, -138); ctx.lineTo(-9, -138); ctx.closePath(); ctx.fill()
    ctx.restore()
    dibujarTejo(cx, lanzaY)

    // Barra de fuerza
    const bx = W - 34, bh = Math.min(200, H * 0.3), by = lanzaY + 20 - bh
    ctx.fillStyle = 'rgba(20,10,4,.7)'; rr(bx - 4, by - 4, 26, bh + 8, 8); ctx.fill()
    const gf = ctx.createLinearGradient(0, by + bh, 0, by)
    gf.addColorStop(0, '#4cd964'); gf.addColorStop(0.6, '#fcd116'); gf.addColorStop(1, '#ff3b30')
    ctx.fillStyle = gf
    const h = bh * (fase === 'fuerza' ? fuerza : 0)
    rr(bx, by + bh - h, 18, Math.max(h, 0.1), 5); ctx.fill()
    ctx.fillStyle = '#f3e2c7'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('FUERZA', bx + 9, by - 10)
  }

  // Indicador de viento
  if (viento !== 0 && (fase === 'apuntar' || fase === 'fuerza')) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    const dir = Math.sign(viento)
    for (let i = 0; i < Math.abs(viento); i++) {
      const y = H * 0.55 + i * 12
      const off = ((t * 120 * dir) % 80 + 80) % 80
      ctx.beginPath(); ctx.moveTo(20 + off, y); ctx.lineTo(50 + off, y); ctx.stroke()
    }
    ctx.restore()
  }

  // Tejo volando
  if (tejo && fase === 'vuelo') {
    const p = tejo.p
    const x = tejo.x0 + (tejo.x1 - tejo.x0) * p
    const y = tejo.y0 + (tejo.y1 - tejo.y0) * p
    const z = Math.sin(Math.PI * p) * (60 + fuerza * 90)
    ctx.fillStyle = 'rgba(0,0,0,.3)'
    ctx.beginPath(); ctx.ellipse(x, y, 13, 7, 0, 0, Math.PI * 2); ctx.fill()
    dibujarTejo(x, y - z, 1 + z / 160)
  }
  if (tejo && fase === 'resultado') dibujarTejo(tejo.x1, tejo.y1, 0.9)
}

function dibujarEfectos () {
  for (const p of particulas) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.vida))
    ctx.fillStyle = p.c
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  if (flash > 0) { ctx.fillStyle = `rgba(255,230,150,${flash * 0.45})`; ctx.fillRect(0, 0, W, H) }
  if (popup && popup.vida > 0) {
    const a = Math.min(1, popup.vida * 2)
    const s = 1 + Math.max(0, popup.vida - 1.1) * 1.5
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, H * 0.58); ctx.scale(s, s)
    ctx.textAlign = 'center'; ctx.font = '900 34px system-ui'
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.6)'
    ctx.strokeText(popup.texto, 0, 0)
    ctx.fillStyle = popup.color; ctx.fillText(popup.texto, 0, 0)
    if (popup.pts) {
      ctx.font = '800 24px system-ui'
      ctx.strokeText('+' + popup.pts, 0, 34); ctx.fillStyle = '#fff'; ctx.fillText('+' + popup.pts, 0, 34)
    }
    ctx.restore()
  }
}

function dibujar () {
  dibujarCancha()
  if (estado === 'jugando' || estado === 'pausa') { dibujarControles(); dibujarEfectos() }
}

// ---------- Bucle ----------
let ultimo = performance.now()
function bucle (ahora) {
  const dt = Math.min((ahora - ultimo) / 1000, 0.05)
  ultimo = ahora
  if (estado === 'jugando') actualizar(dt)
  dibujar()
  requestAnimationFrame(bucle)
}
requestAnimationFrame(bucle)
