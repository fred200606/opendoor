import { useEffect, useRef } from 'react';
import body from '../../assets/mascot-happy/body.webp';
import eyeMask from '../../assets/mascot-happy/eye-mask.png';
import head from '../../assets/mascot-happy/head.webp';
import shineLeft from '../../assets/mascot-happy/shine-left.png';
import shineRight from '../../assets/mascot-happy/shine-right.png';
import { ease, lerp, partFinder, runClock, seg, useSvgPrefix } from './svgIds.js';
import useMascotStill from './useMascotStill.js';

// The happy mascot from mascot-happy.html (animation only): he crouches, jumps for joy with his
// arms up in a burst of confetti, lands with a squash, then keeps bouncing happily.
// Art space 1471 × 1253.
const FEET = [705, 1218];
const BODY_H = 380;
const NECK = [700, 850];
const FPS = 24;
const COLORS = ['#be7dfc', '#6225aa', '#fc9721', '#ffd23f', '#fff8e5', '#9fd0ff'];
const CONFETTI = 46;

// Deterministic, so every celebration looks the same.
function confettiPlan() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: CONFETTI }, (_, i) => {
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    const sp = 1300 + rnd() * 1100;
    return {
      front: i % 3 === 0,
      circle: i % 4 === 0,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      spin: (rnd() - 0.5) * 900,
      flut: 2 + rnd() * 4,
      ph: rnd() * 6,
      delay: rnd() * 0.12,
    };
  });
}
const PLAN = confettiPlan();

function piece(p, item, i) {
  const look = `fill="${COLORS[i % COLORS.length]}" stroke="#1f0440" stroke-width="8"`;
  return item.circle ? `<circle id="${p}C${i}" r="26" ${look}/>` : `<rect id="${p}C${i}" x="-40" y="-20" width="80" height="40" rx="8" ${look}/>`;
}

function arm(p, side) {
  return `<g id="${p}Arm${side}">
    <path class="o" fill="none" stroke="#1f0440" stroke-width="128" stroke-linecap="round"/>
    <path class="f" fill="none" stroke="#fbf8fd" stroke-width="88" stroke-linecap="round"/>
    <use href="#${p}Glove" class="g"/>
  </g>`;
}

function markup(p) {
  return `
<defs>
  <filter id="${p}Boil" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence id="${p}Turb" type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="1"/>
    <feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <mask id="${p}EyeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1471" height="1253">
    <image href="${eyeMask}" x="0" y="0" width="1471" height="1253"/>
  </mask>
  <g id="${p}Glove" stroke="#1f0440" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" fill="#fbf8fd">
    <ellipse cx="22" cy="-100" rx="74" ry="68"/>
    <rect x="-28" y="-248" width="50" height="128" rx="25" transform="rotate(-14 -3 -130)"/>
    <rect x="12" y="-262" width="50" height="142" rx="25" transform="rotate(2 37 -130)"/>
    <rect x="48" y="-238" width="48" height="118" rx="24" transform="rotate(18 72 -130)"/>
    <rect x="-30" y="-176" width="48" height="96" rx="24" transform="rotate(-62 -6 -110)"/>
    <ellipse cx="22" cy="-104" rx="62" ry="56" stroke="none"/>
    <path d="M2 -78 L2 -116 M24 -76 L24 -120 M46 -78 L46 -116" fill="none" stroke-width="12"/>
    <rect x="-46" y="-48" width="136" height="54" rx="27"/>
  </g>
  <path id="${p}Twinkle" d="M0 -40 C5 -8 8 -5 40 0 C8 5 5 8 0 40 C-5 8 -8 5 -40 0 C-8 -5 -5 -8 0 -40Z"/>
</defs>
<ellipse id="${p}Shadow" cx="705" cy="1222" rx="420" ry="26" fill="#0b0226" opacity=".13"/>
<g>${PLAN.map((item, i) => (item.front ? '' : piece(p, item, i))).join('')}</g>
<g filter="url(#${p}Boil)">
  <g id="${p}Char">
    ${arm(p, 'L')}
    ${arm(p, 'R')}
    <g id="${p}Body"><image href="${body}" x="0" y="0" width="1471" height="1253"/></g>
    <g id="${p}Head">
      <image href="${head}" x="0" y="0" width="1471" height="1253"/>
      <g mask="url(#${p}EyeMask)">
        <g id="${p}Pupils">
          <circle cx="555.4" cy="565" r="143.9" fill="#1f0440"/>
          <image href="${shineLeft}" x="574" y="547" width="66" height="92"/>
          <circle cx="967.3" cy="560.8" r="139.4" fill="#1f0440"/>
          <image href="${shineRight}" x="983" y="544" width="66" height="90"/>
        </g>
        <g id="${p}Lids" visibility="hidden">
          <rect id="${p}Lid" x="270" y="350" width="820" height="0" fill="#bd7cfb"/>
          <rect id="${p}LidLine" x="270" y="350" width="820" height="22" fill="#1f0440"/>
        </g>
      </g>
    </g>
  </g>
</g>
<g fill="#ffd23f" stroke="#1f0440" stroke-width="8" stroke-linejoin="round">
  ${Array.from({ length: 6 }, (_, i) => `<use id="${p}S${i}" href="#${p}Twinkle"/>`).join('')}
</g>
<g>${PLAN.map((item, i) => (item.front ? piece(p, item, i) : '')).join('')}</g>`;
}

/**
 * The happy mascot for happy moments: an application sent, Get started finished, ratings sent.
 * He celebrates once when he appears (a jump, arms up, confetti), then keeps bouncing. Decoration
 * only, hidden from screen readers; with Reduce motion or Quiet mode he holds the arms-up pose.
 */
export default function MascotHappy({ className = 'w-44', forceStill = false, noConfetti = false }) {
  const p = useSvgPrefix();
  const svgRef = useRef(null);
  const preferenceStill = useMascotStill();
  const still = forceStill || preferenceStill;

  useEffect(() => {
    const svg = svgRef.current;
    const $ = partFinder(svg, p);
    const confetti = PLAN.map((item, i) => ({ ...item, el: $(`C${i}`) }));
    const sparkles = Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI * (0.1 + (0.8 * i) / 5);
      return { el: $(`S${i}`), x: 705 + Math.cos(a) * 820, y: 380 + Math.sin(a) * 520, d: i * 0.12 };
    });

    function setArm(el, shoulder, ctrl, wrist, rot, scale, mirror) {
      const d = `M${shoulder[0]} ${shoulder[1]} Q${ctrl[0]} ${ctrl[1]} ${wrist[0]} ${wrist[1]}`;
      el.querySelector('.o').setAttribute('d', d);
      el.querySelector('.f').setAttribute('d', d);
      const glove = el.querySelector('.g');
      glove.setAttribute('transform', `translate(${wrist[0]} ${wrist[1]}) rotate(${rot}) scale(${mirror ? -scale : scale} ${scale})`);
      glove.style.visibility = scale < 0.05 ? 'hidden' : 'visible';
    }

    // T = seconds on screen; c = seconds since the celebration started.
    function frame(T, c) {
      const crouch = Math.sin((seg(c, 0, 0.28) * Math.PI) / 2) * (1 - seg(c, 0.28, 0.36));
      const air = seg(c, 0.3, 1.05);
      const jumpY = air > 0 && air < 1 ? Math.sin(air * Math.PI) * 300 : 0;
      const land = c > 1.05 && c < 1.55 ? Math.sin(seg(c, 1.05, 1.55) * Math.PI) * Math.exp(-seg(c, 1.05, 1.55) * 2) : 0;
      const stretch = air > 0 && air < 1 ? 0.07 * (1 - Math.abs(air - 0.5) * 2) : 0;
      const ph = (T / 1.3) % 1;
      const bounce = Math.pow(Math.abs(Math.sin(Math.PI * ph)), 1.5);
      const hopT = T % 5;
      const hop = c > 3 && hopT > 4 && hopT < 4.8 ? Math.abs(Math.sin(seg(hopT, 4, 4.8) * Math.PI * 2)) * 60 : 0;
      const s = 1 + 0.015 * bounce - 0.1 * crouch + stretch - 0.12 * land;
      const sx = 1 / Math.sqrt(s);
      const lift = jumpY + hop + 10 * bounce;
      $('Char').setAttribute('transform', `translate(0 ${-lift})`);
      $('Body').setAttribute('transform', `translate(${FEET[0]} ${FEET[1]}) scale(${sx} ${s}) translate(${-FEET[0]} ${-FEET[1]})`);
      const rise = BODY_H * (s - 1);
      const tilt = 2.5 * Math.sin((2 * Math.PI * T) / 2.6) * (c > 2 ? 1 : 0.3);
      $('Head').setAttribute('transform', `translate(0 ${-rise - 12 * stretch * 10}) rotate(${tilt} ${NECK[0]} ${NECK[1]})`);
      $('Shadow').setAttribute('rx', (420 / s) * (1 - lift / 900));
      $('Shadow').setAttribute('opacity', (0.13 * (1 - lift / 700)).toFixed(3));

      const up = c < 0.3 ? 0 : c < 0.6 ? ease.outBack(seg(c, 0.3, 0.6), 1.8) : c < 2.4 ? 1 : 1 - ease.inOut(seg(c, 2.4, 3.0));
      const hopUp = hop > 0 ? 0.55 * Math.sin(seg(hopT, 4, 4.8) * Math.PI) : 0;
      const u = Math.max(up, hopUp);
      const wig = Math.sin(T * 14) * (c > 0.6 && c < 2.4 ? 1 : 0);
      const shY = lerp(870, 900, u) - rise * 0.8;
      setArm(
        $('ArmL'),
        [425, shY],
        [lerp(390, 120, u), lerp(930, 980, u)],
        [lerp(418, 10 - 10 * wig, u), lerp(985, 620, u)],
        lerp(-210, -12 + 10 * wig, u),
        u < 0.15 ? 0 : 1.25,
        true,
      );
      setArm(
        $('ArmR'),
        [1000, shY],
        [lerp(1040, 1350, u), lerp(915, 980, u)],
        [lerp(1012, 1420 + 10 * wig, u), lerp(980, 620, u)],
        lerp(210, 12 - 10 * wig, u),
        u < 0.15 ? 0 : 1.25,
        false,
      );

      const dy = c < 2.2 ? lerp(0, -40, ease.inOut(seg(c, 0.3, 0.6))) * (1 - ease.inOut(seg(c, 1.6, 2.1))) : 0;
      const dx = -30 * (c > 2.2 ? 1 : seg(c, 1.6, 2.1));
      $('Pupils').setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
      let shut = 0;
      for (const b of [2.3, 6.1, 9.7]) {
        const k = (T - b) % 7.2;
        if (k > 0 && k < 0.18) shut = Math.sin((Math.PI * k) / 0.18);
      }
      if (c > 1.05 && c < 1.3) shut = Math.max(shut, Math.sin(seg(c, 1.05, 1.3) * Math.PI) * 0.8);
      $('Lids').setAttribute('visibility', shut > 0 ? 'visible' : 'hidden');
      $('Lid').setAttribute('height', 320 * shut);
      $('LidLine').setAttribute('y', 350 + 320 * shut - 11);

      for (const item of confetti) {
        const k = c - 0.4 - item.delay;
        if (noConfetti || k <= 0 || k > 3.4) {
          item.el.setAttribute('visibility', 'hidden');
          continue;
        }
        item.el.setAttribute('visibility', 'visible');
        const drag = 1 - Math.exp(-k * 2.2);
        const x = 705 + (item.vx / 2.2) * drag + Math.sin(k * item.flut + item.ph) * 40 * seg(k, 0.4, 1);
        const y = 40 + (item.vy / 2.2) * drag + 360 * Math.max(0, k - 0.3) * Math.max(0, k - 0.3) * 0.6;
        const flip = Math.cos(k * item.flut * 2 + item.ph);
        item.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(item.spin * k).toFixed(1)}) scale(1 ${flip.toFixed(2)})`);
        item.el.setAttribute('opacity', (1 - seg(k, 2.8, 3.4)).toFixed(2));
      }
      for (const sp of sparkles) {
        const k = c - 0.5 - sp.d;
        const v = k > 0 && k < 1.2 ? Math.sin(seg(k, 0, 1.2) * Math.PI) : 0;
        sp.el.setAttribute('transform', `translate(${sp.x} ${sp.y - lift * 0.3}) rotate(${k * 90}) scale(${v})`);
      }
      $('Turb').setAttribute('seed', 1 + (Math.floor(T * 6) % 4));
    }

    if (still) {
      frame(1, 1.8); // arms up, confetti in the air
      return undefined;
    }
    frame(0, 0);
    return runClock(svg, FPS, (T) => frame(T, T));
  }, [p, still, noConfetti]);

  return (
    <svg
      ref={svgRef}
      viewBox="-180 -420 1830 1720"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto overflow-visible ${className}`}
      dangerouslySetInnerHTML={{ __html: markup(p) }}
    />
  );
}
