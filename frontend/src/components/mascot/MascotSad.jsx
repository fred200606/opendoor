import { useEffect, useRef } from 'react';
import body from '../../assets/mascot-sad/body.webp';
import eyeMask from '../../assets/mascot-sad/eye-mask.png';
import head from '../../assets/mascot-sad/head.webp';
import shineLeft from '../../assets/mascot-sad/shine-left.png';
import shineRight from '../../assets/mascot-sad/shine-right.png';
import { ease, lerp, partFinder, runClock, seg, useSvgPrefix } from './svgIds.js';
import useMascotStill from './useMascotStill.js';

// The sad mascot from mascot-sad.html (animation only): he slumps under a little rain cloud,
// sighs, glances up hopefully, and a single tear rolls down. Art space 1472 × 1253.
const FEET = [710, 1232];
const BODY_H = 390;
const NECK = [700, 850];
const LOOP = 9;
const FPS = 24;
const LOOKS = [
  [0, -18, 26],
  [4.6, -6, -18],
  [6.4, -22, 30],
  [8.4, -18, 26],
];
const BLINKS = [3.4, 7.6];

function markup(p) {
  return `
<defs>
  <filter id="${p}Boil" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence id="${p}Turb" type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="1"/>
    <feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <mask id="${p}EyeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1472" height="1253">
    <image href="${eyeMask}" x="0" y="0" width="1472" height="1253"/>
  </mask>
  <path id="${p}Drop" d="M0 -52 C15 -21 33 0 33 21 A33 33 0 0 1 -33 21 C-33 0 -15 -21 0 -52Z"/>
</defs>
<ellipse id="${p}Shadow" cx="710" cy="1236" rx="430" ry="26" fill="#0b0226" opacity=".13"/>
<g filter="url(#${p}Boil)">
  <g id="${p}Body"><image href="${body}" x="0" y="0" width="1472" height="1253"/></g>
  <g id="${p}Head">
    <image href="${head}" x="0" y="0" width="1472" height="1253"/>
    <g mask="url(#${p}EyeMask)">
      <g id="${p}Pupils">
        <circle cx="532.5" cy="576.8" r="149.7" fill="#1b0336"/>
        <image href="${shineLeft}" x="543" y="546" width="74" height="101"/>
        <circle cx="947" cy="560" r="124" fill="#1b0336"/>
        <image href="${shineRight}" x="992" y="547" width="74" height="104"/>
      </g>
      <g id="${p}Lids" visibility="hidden">
        <rect id="${p}Lid" x="230" y="300" width="900" height="0" fill="#bd7cfb"/>
        <rect id="${p}LidLine" x="230" y="300" width="900" height="22" fill="#1b0336"/>
      </g>
    </g>
    <g id="${p}TearOnFace" visibility="hidden"><use href="#${p}Drop" fill="#9fd0ff" stroke="#1b0336" stroke-width="10"/></g>
  </g>
  <g id="${p}TearFall" visibility="hidden"><use href="#${p}Drop" fill="#9fd0ff" stroke="#1b0336" stroke-width="10"/></g>
  <g id="${p}Splash" fill="none" stroke="#1b0336" stroke-width="10" stroke-linecap="round" visibility="hidden">
    <path d="M-34 0 l-26 -20 M34 0 l26 -20 M0 -8 l0 -28"/>
  </g>
  <g id="${p}Puff" visibility="hidden" fill="#f4ecff" stroke="#1b0336" stroke-width="10">
    <circle cx="0" cy="0" r="30"/><circle cx="32" cy="-12" r="22"/><circle cx="28" cy="18" r="18"/>
  </g>
  <g id="${p}Cloud">
    <g id="${p}Rain" stroke="#7fb4ff" stroke-width="12" stroke-linecap="round">
      ${Array.from({ length: 6 }, (_, i) => `<path id="${p}Drop${i}"/>`).join('')}
    </g>
    <path d="M-210 40 C-280 40 -290 -40 -225 -55 C-230 -130 -130 -160 -85 -105 C-55 -175 70 -185 95 -100 C140 -150 235 -110 215 -40 C285 -30 275 40 210 40 Z" fill="#cfc4e3" stroke="#1b0336" stroke-width="16" stroke-linejoin="round"/>
    <path d="M-150 -40 C-140 -80 -100 -95 -70 -80" fill="none" stroke="#eee8f8" stroke-width="12" stroke-linecap="round"/>
  </g>
</g>`;
}

function look(t) {
  let dx = LOOKS[0][1];
  let dy = LOOKS[0][2];
  for (let i = 1; i < LOOKS.length; i++) {
    const [tt, x, y] = LOOKS[i];
    if (t < tt) break;
    const k = ease.inOut(seg(t, tt, tt + 0.45));
    dx = lerp(LOOKS[i - 1][1], x, k);
    dy = lerp(LOOKS[i - 1][2], y, k);
  }
  let shut = 0;
  for (const b of BLINKS) {
    const u = (t - b) / 0.45;
    if (u > 0 && u < 1) shut = Math.sin(Math.PI * u);
  }
  return { dx, dy, shut };
}

/**
 * The sad mascot for sad moments: a suspended account, a page that isn't there, an empty list, or
 * steps still to do. Decoration only (hidden from screen readers; the words beside it say what is
 * wrong). With Reduce motion or Quiet mode he holds one still, sorry pose.
 */
export default function MascotSad({ className = 'w-40' }) {
  const p = useSvgPrefix();
  const svgRef = useRef(null);
  const still = useMascotStill();

  useEffect(() => {
    const svg = svgRef.current;
    const $ = partFinder(svg, p);
    const drops = Array.from({ length: 6 }, (_, i) => ({ el: $(`Drop${i}`), x: -150 + i * 60 + (i % 2) * 14, off: i * 0.37 }));

    function frame(T) {
      const t = T % LOOP;
      const breath = Math.sin((2 * Math.PI * T) / 4.5) * 0.007;
      const sigh = ease.inOut(seg(t, 1.0, 2.2)) * (1 - ease.inOut(seg(t, 2.2, 3.6)));
      const slump = Math.sin(seg(t, 2.6, 4.2) * Math.PI) * 0.6;
      const s = 1 + breath + 0.028 * sigh - 0.02 * slump;
      const sx = 1 / Math.sqrt(s);
      const rise = BODY_H * (s - 1);
      $('Body').setAttribute('transform', `translate(${FEET[0]} ${FEET[1]}) scale(${sx} ${s}) translate(${-FEET[0]} ${-FEET[1]})`);
      const tilt = -2.2 + 1.3 * Math.sin((2 * Math.PI * T) / 6.2) - 1.5 * sigh + 2 * slump;
      const headY = -rise - 10 * sigh + 14 * slump;
      $('Head').setAttribute('transform', `translate(0 ${headY}) rotate(${tilt} ${NECK[0]} ${NECK[1]})`);
      $('Shadow').setAttribute('rx', 430 / s);

      const pk = seg(t, 2.3, 3.7);
      const puff = $('Puff');
      if (pk > 0 && pk < 1) {
        puff.setAttribute('visibility', 'visible');
        puff.setAttribute('transform', `translate(${745 + 120 * ease.out(pk)} ${760 + headY + 60 * pk}) scale(${0.4 + 0.9 * ease.out(pk)})`);
        puff.setAttribute('opacity', (1 - ease.in(pk)).toFixed(2));
      } else puff.setAttribute('visibility', 'hidden');

      const e = look(t);
      $('Pupils').setAttribute('transform', `translate(${e.dx.toFixed(1)} ${e.dy.toFixed(1)})`);
      $('Lids').setAttribute('visibility', e.shut > 0 ? 'visible' : 'hidden');
      const lh = 340 * e.shut;
      $('Lid').setAttribute('height', lh);
      $('LidLine').setAttribute('y', 300 + lh - 11);

      const TX = 318;
      const TY0 = 655;
      const TY1 = 840;
      const grow = seg(t, 4.9, 5.6);
      const roll = ease.in(seg(t, 5.6, 6.6));
      const fall = seg(t, 6.6, 7.05);
      const splash = seg(t, 7.05, 7.4);
      const onFace = $('TearOnFace');
      if (grow > 0 && roll < 1) {
        const g = 0.25 + 0.75 * ease.out(grow);
        onFace.setAttribute('visibility', 'visible');
        onFace.setAttribute('transform', `translate(${TX - 6 * roll} ${lerp(TY0, TY1, roll)}) scale(${g} ${g * (1 + 0.25 * roll)})`);
      } else onFace.setAttribute('visibility', 'hidden');
      const falling = $('TearFall');
      if (fall > 0 && fall < 1) {
        falling.setAttribute('visibility', 'visible');
        falling.setAttribute('transform', `translate(${TX - 8} ${lerp(TY1 + headY, 1215, fall * fall)}) scale(1 1.2)`);
      } else falling.setAttribute('visibility', 'hidden');
      const splashEl = $('Splash');
      if (splash > 0 && splash < 1) {
        splashEl.setAttribute('visibility', 'visible');
        splashEl.setAttribute('transform', `translate(${TX - 8} 1225) scale(${0.5 + splash})`);
        splashEl.setAttribute('opacity', (1 - splash).toFixed(2));
      } else splashEl.setAttribute('visibility', 'hidden');

      const cx = 700 + 18 * Math.sin((2 * Math.PI * T) / 5.3);
      const cy = -250 + 12 * Math.sin((2 * Math.PI * T) / 3.1) + headY * 0.5;
      $('Cloud').setAttribute('transform', `translate(${cx} ${cy})`);
      for (const d of drops) {
        const k = (T / 1.1 + d.off) % 1;
        const y0 = 50 + k * 230;
        d.el.setAttribute('d', `M${d.x} ${y0} L${d.x - 6} ${y0 + 34}`);
        d.el.setAttribute('opacity', (k < 0.85 ? 1 : (1 - k) / 0.15).toFixed(2));
      }
      $('Turb').setAttribute('seed', 1 + (Math.floor(T * 6) % 4));
    }

    frame(0);
    if (still) {
      frame(0.5);
      return undefined;
    }
    return runClock(svg, FPS, frame);
  }, [p, still]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 -460 1472 1720"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto overflow-visible ${className}`}
      dangerouslySetInnerHTML={{ __html: markup(p) }}
    />
  );
}
