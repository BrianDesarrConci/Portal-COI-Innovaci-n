import { useEffect, useRef } from 'react';

/**
 * Constelación de clientes alrededor del núcleo COI (Canvas 2D).
 * - Órbitas inclinadas con profundidad, enlaces al núcleo y pulsos de operación.
 * - Paralaje suave con el puntero.
 * - Se detiene con la pestaña oculta y dibuja un cuadro fijo con prefers-reduced-motion.
 */

const CLIENTS = [
  'BBVA', 'Colfondos', 'Protección', 'Porvenir', 'Bancolombia', 'Banco Agrario',
  'Banco Popular', 'SNR', 'Banco de Bogotá', 'Banco de Occidente', 'Davivienda',
  'Fincomercio', 'Citibank', 'Banco Caja Social', 'Coopcentral', 'Banco Unión',
];

// Colores de marca (tokens de styles.css).
const C = {
  green: [4, 140, 56],
  greenLite: [52, 196, 108], // tinte de --green para brillo sobre navy
  cyan: [33, 187, 234],
  white: [255, 255, 255],
  navyText: [169, 176, 214],
  navyDeep: [28, 35, 71],
  navyLine: [52, 59, 107],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Tres órbitas: 4 + 6 + 6 clientes.
const ORBITS = [
  { r: 0.44, n: 4, speed: 0.040, phase: 0.35 },
  { r: 0.72, n: 6, speed: -0.026, phase: 0.1 },
  { r: 1.0, n: 6, speed: 0.018, phase: 0.62 },
];

function buildNodes() {
  const nodes = [];
  let k = 0;
  ORBITS.forEach((o, oi) => {
    for (let i = 0; i < o.n; i += 1) {
      nodes.push({
        name: CLIENTS[k],
        orbit: oi,
        a0: (i / o.n) * Math.PI * 2 + o.phase * Math.PI * 2,
        color: k % 3 === 1 ? 'green' : 'cyan',
        flash: 0,
        x: 0, y: 0, z: 0, s: 1,
      });
      k += 1;
    }
  });
  return nodes;
}

function makeGlow(color, size) {
  const g = document.createElement('canvas');
  g.width = g.height = size;
  const ctx = g.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgba(color, 0.9));
  grad.addColorStop(0.25, rgba(color, 0.35));
  grad.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return g;
}

export default function Constellation({ className = '', anchorRef }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = buildNodes();
    const glow = { cyan: makeGlow(C.cyan, 64), green: makeGlow(C.greenLite, 64), white: makeGlow(C.white, 64) };
    // Enlaces entre clientes vecinos (constelación).
    const links = [];
    nodes.forEach((n, i) => {
      const next = nodes.find((m, j) => j > i && m.orbit === n.orbit);
      if (next) links.push([i, nodes.indexOf(next)]);
      if (n.orbit < 2 && i % 2 === 0) {
        const outer = nodes.filter((m) => m.orbit === n.orbit + 1);
        links.push([i, nodes.indexOf(outer[i % outer.length])]);
      }
    });

    let w = 0; let h = 0; let dpr = 1;
    let geo = { cx: 0, cy: 0, R: 0, tilt: 0.56, labels: true, scale: 1 };
    let raf = 0; let last = 0; let t = 0; let spawnAcc = 0;
    const pulses = [];
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width); h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      // El área de órbitas la define el elemento ancla (franja libre del escenario).
      const a = anchorRef?.current?.getBoundingClientRect();
      const box = a && a.width > 0 && a.height > 0
        ? { x: a.left - rect.left, y: a.top - rect.top, w: a.width, h: a.height }
        : { x: w * 0.35, y: h * 0.1, w: w * 0.6, h: h * 0.5 };
      const roomy = box.w >= 520;
      const pad = roomy ? 120 : 12; // espacio horizontal para etiquetas
      const Rw = Math.min((box.w - 2 * pad) / 2, 420);
      // En franjas bajas la órbita se aplana (perspectiva) antes que encogerse.
      const tilt = Math.max(0.42, Math.min(0.6, (box.h - 24) / (2 * Rw)));
      const R = Math.max(60, Math.min(Rw, (box.h - 24) / (2 * tilt)));
      const labels = roomy && R >= 170;
      geo = { cx: box.x + box.w / 2, cy: box.y + box.h / 2, R, tilt, labels, scale: Math.max(0.8, Math.min(1.12, R / 280)) };
    };

    const spawn = () => {
      const i = Math.floor(Math.random() * nodes.length);
      const inbound = Math.random() < 0.55; // cliente → COI (operación cerrada) en verde
      pulses.push({ i, inbound, p: 0, dur: 1.5 + Math.random() * 1.1, color: inbound ? 'green' : 'cyan' });
    };

    const place = () => {
      const { cx, cy, R, tilt } = geo;
      const px = pointer.x; const py = pointer.y;
      nodes.forEach((n) => {
        const o = ORBITS[n.orbit];
        const a = n.a0 + t * o.speed;
        const r = R * o.r;
        const z = Math.sin(a); // -1 atrás, 1 adelante
        const depth = 0.5 + 0.5 * z;
        n.z = z;
        n.s = 0.72 + 0.42 * depth;
        n.x = cx + Math.cos(a) * r + px * (10 + 18 * depth);
        n.y = cy + Math.sin(a) * r * tilt + py * (8 + 14 * depth);
      });
    };

    const core = () => ({ x: geo.cx + pointer.x * 6, y: geo.cy + pointer.y * 5 });

    const drawRings = (cc) => {
      const { R, tilt } = geo;
      ctx.lineWidth = 1;
      [0.24, 0.44, 0.72, 1.0, 1.22].forEach((f, idx) => {
        ctx.beginPath();
        ctx.ellipse(cc.x, cc.y, R * f, R * f * tilt, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(C.white, idx === 4 ? 0.04 : 0.075);
        ctx.setLineDash(idx === 4 ? [2, 6] : []);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // Arcos de marca (cian exterior, verde interior) que giran lento.
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cc.x, cc.y, R, R * tilt, 0, t * 0.05 + 4.1, t * 0.05 + 4.95);
      ctx.strokeStyle = rgba(C.cyan, 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cc.x, cc.y, R * 0.44, R * 0.44 * tilt, 0, -t * 0.08 + 0.6, -t * 0.08 + 1.55);
      ctx.strokeStyle = rgba(C.greenLite, 0.85);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cc.x, cc.y, R * 0.72, R * 0.72 * tilt, 0, t * 0.03 + 2.2, t * 0.03 + 2.6);
      ctx.strokeStyle = rgba(C.white, 0.35);
      ctx.stroke();
    };

    const drawCore = (cc) => {
      const s = geo.scale;
      const r = 34 * s;
      const breath = reduce.matches ? 0 : Math.sin(t * 1.6) * 0.5 + 0.5;
      ctx.globalCompositeOperation = 'lighter';
      const gs = r * (4.2 + breath * 0.6);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glow.cyan, cc.x - gs / 2, cc.y - gs / 2, gs, gs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(cc.x, cc.y, r + 10 * s, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(C.white, 0.12); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(cc.x, cc.y, r, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(cc.x, cc.y - r, cc.x, cc.y + r);
      g.addColorStop(0, '#2C336A'); g.addColorStop(1, rgba(C.navyDeep, 1));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba(C.cyan, 0.55); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.lineCap = 'round'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.arc(cc.x, cc.y, r + 10 * s, t * 0.6, t * 0.6 + 1.1);
      ctx.strokeStyle = rgba(C.cyan, 0.95); ctx.stroke();
      ctx.beginPath(); ctx.arc(cc.x, cc.y, r + 10 * s, -t * 0.45 + 3.2, -t * 0.45 + 3.9);
      ctx.strokeStyle = rgba(C.greenLite, 0.95); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(19 * s)}px Ubuntu, 'Segoe UI', Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('COI', cc.x, cc.y + 1);
    };

    const drawLinks = (cc) => {
      ctx.lineWidth = 1;
      nodes.forEach((n) => {
        const a = 0.05 + 0.09 * (0.5 + 0.5 * n.z) + n.flash * 0.25;
        ctx.beginPath(); ctx.moveTo(cc.x, cc.y); ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = rgba(n.flash > 0.05 ? C[n.color === 'green' ? 'greenLite' : 'cyan'] : C.white, a);
        ctx.stroke();
      });
      links.forEach(([i, j]) => {
        const A = nodes[i]; const B = nodes[j];
        const a = 0.05 + 0.06 * (0.5 + 0.25 * (A.z + B.z));
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
        ctx.strokeStyle = rgba(C.navyText, a); ctx.stroke();
      });
    };

    const drawPulses = (cc) => {
      ctx.globalCompositeOperation = 'lighter';
      pulses.forEach((p) => {
        const n = nodes[p.i];
        const e = p.p < 0.5 ? 2 * p.p * p.p : 1 - ((-2 * p.p + 2) ** 2) / 2;
        const from = p.inbound ? n : cc; const to = p.inbound ? cc : n;
        const hx = from.x + (to.x - from.x) * e; const hy = from.y + (to.y - from.y) * e;
        const tail = Math.max(0, e - 0.16);
        const tx = from.x + (to.x - from.x) * tail; const ty = from.y + (to.y - from.y) * tail;
        const col = p.color === 'green' ? C.greenLite : C.cyan;
        const fade = Math.sin(Math.PI * Math.min(1, p.p * 1.05));
        const lg = ctx.createLinearGradient(tx, ty, hx, hy);
        lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(1, rgba(col, 0.9 * fade));
        ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        const gs = 22;
        ctx.globalAlpha = fade;
        ctx.drawImage(glow[p.color], hx - gs / 2, hy - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      });
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawNodes = (front) => {
      const sorted = nodes.filter((n) => (front ? n.z >= 0 : n.z < 0)).sort((a, b) => a.z - b.z);
      sorted.forEach((n) => {
        const depth = 0.5 + 0.5 * n.z;
        const col = n.color === 'green' ? C.greenLite : C.cyan;
        const r = (3.2 + 2.2 * depth) * geo.scale;
        if (n.flash > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          const gs = r * (6 + 6 * n.flash);
          ctx.globalAlpha = Math.min(1, n.flash * 1.2);
          ctx.drawImage(glow[n.color], n.x - gs / 2, n.y - gs / 2, gs, gs);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.navyDeep, 0.9); ctx.fill();
        ctx.strokeStyle = rgba(col, 0.25 + 0.35 * depth); ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(col, 0.55 + 0.45 * depth); ctx.fill();
        if (geo.labels) {
          const alpha = 0.4 + 0.55 * depth;
          if (alpha > 0.02) {
            const fs = Math.round((10.5 + 2 * depth) * geo.scale);
            ctx.font = `500 ${fs}px 'Noto Sans', 'Segoe UI', Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(n.name).width;
            let right = n.x >= core().x;
            if (right && n.x + r + 9 + tw > w - 16) right = false;
            else if (!right && n.x - r - 9 - tw < 16) right = true;
            ctx.textAlign = right ? 'left' : 'right';
            const lx = n.x + (right ? 1 : -1) * (r + 9);
            ctx.fillStyle = rgba(n.flash > 0.1 ? C.white : C.navyText, alpha + n.flash * 0.3);
            ctx.fillText(n.name, lx, n.y);
          }
        }
      });
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      place();
      const cc = core();
      drawRings(cc);
      drawLinks(cc);
      drawNodes(false);
      drawPulses(cc);
      drawCore(cc);
      drawNodes(true);
    };

    const step = (now) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; t += dt;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
      spawnAcc += dt;
      while (spawnAcc > 0.34) { spawnAcc -= 0.34; if (pulses.length < 14) spawn(); }
      for (let k = pulses.length - 1; k >= 0; k -= 1) {
        const p = pulses[k];
        p.p += dt / p.dur;
        if (p.p >= 1) {
          if (!p.inbound) nodes[p.i].flash = 1;
          pulses.splice(k, 1);
        }
      }
      nodes.forEach((n) => { n.flash = Math.max(0, n.flash - dt * 1.4); });
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => { if (!raf && !reduce.matches && !document.hidden) { last = 0; raf = requestAnimationFrame(step); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    const staticFrame = () => {
      t = 18; pulses.length = 0;
      [[2, 0.55, true], [5, 0.4, false], [9, 0.7, true], [12, 0.5, false], [14, 0.3, true]].forEach(([i, p, inbound]) => {
        pulses.push({ i, inbound, p, dur: 1, color: inbound ? 'green' : 'cyan' });
      });
      nodes[7].flash = 0.8;
      draw();
    };

    const onResize = () => { layout(); if (reduce.matches || !raf) { if (reduce.matches) staticFrame(); else draw(); } };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    const onMove = (e) => {
      if (reduce.matches) return;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onLeave = () => { pointer.tx = 0; pointer.ty = 0; };
    const onMotion = () => { if (reduce.matches) { stop(); staticFrame(); } else start(); };

    layout();
    if (reduce.matches) staticFrame(); else start();
    // Redibuja cuando cargan las fuentes de marca.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!raf && ref.current) (reduce.matches ? staticFrame() : draw()); });

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    if (anchorRef?.current) ro.observe(anchorRef.current);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    reduce.addEventListener?.('change', onMotion);

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      reduce.removeEventListener?.('change', onMotion);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
