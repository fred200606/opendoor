import { useEffect, useRef } from 'react';
import body from '../../assets/mascot-door/body.webp';
import doorway from '../../assets/mascot-door/doorway.webp';
import eyeMask from '../../assets/mascot-door/eye-mask.png';
import head from '../../assets/mascot-door/head.webp';
import shineLeft from '../../assets/mascot-door/shine-left.png';
import shineRight from '../../assets/mascot-door/shine-right.png';
import { clamp, ease, lerp, partFinder, runClock, seg, useSvgPrefix } from './svgIds.js';
import useMascotStill from './useMascotStill.js';

// The door greeting from mascot-door-login.html (animation only): the door rattles, swings open,
// the mascot hops out and waves, then waves again now and then. He glances at whichever field
// has focus. Art space 1448 × 2000.
const FEET = [718, 1732];
const NECK = [718, 1292];
const BODY_H = 440;
const HINGE = 236;
const DOOR_R = 1201;
const DOOR_B = 1552;
const CY = 1050;
const FOCAL = 5300;
const FPS = 24;
// The doorway's arch, sampled from the art.
const TOP = [[240,740],[252,677],[264,642],[276,615],[288,593],[300,576],[312,557],[324,540],[336,525],[348,511],[360,498],[372,486],[384,475],[396,465],[408,456],[420,447],[432,439],[444,431],[456,424],[468,418],[480,412],[492,406],[504,401],[516,396],[528,391],[540,387],[552,384],[564,380],[576,377],[588,374],[600,372],[612,370],[624,368],[636,366],[648,365],[660,364],[672,363],[684,362],[696,362],[708,362],[720,362],[732,362],[744,362],[756,363],[768,363],[780,364],[792,365],[804,367],[816,368],[828,370],[840,373],[852,375],[864,378],[876,381],[888,384],[900,388],[912,393],[924,397],[936,402],[948,407],[960,413],[972,419],[984,426],[996,433],[1008,440],[1020,449],[1032,458],[1044,467],[1056,478],[1068,489],[1080,501],[1092,514],[1104,528],[1116,544],[1128,561],[1140,580],[1152,600],[1164,625],[1176,655],[1188,687],[1196,734]]; // prettier-ignore
const topAt = (x) => {
  for (let i = 1; i < TOP.length; i++) {
    if (x <= TOP[i][0]) {
      const a = TOP[i - 1];
      const b = TOP[i];
      return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0] || 1));
    }
  }
  return TOP[TOP.length - 1][1];
};
const FACE = [[HINGE, DOOR_B], [HINGE, topAt(240)], ...TOP, [DOOR_R, topAt(1196)], [DOOR_R, DOOR_B]];
function inset(l, t, r, b) {
  const pts = [[HINGE + l, DOOR_B - b]];
  for (let x = HINGE + l; x <= DOOR_R - r; x += 12) pts.push([x, topAt(x) + t]);
  pts.push([DOOR_R - r, topAt(DOOR_R - r) + t], [DOOR_R - r, DOOR_B - b]);
  return pts;
}
const PANEL = inset(130, 120, 130, 120);
const SHINE = (() => {
  const pts = [];
  for (let x = HINGE + 175; x <= HINGE + 470; x += 12) pts.push([x, topAt(x) + 165]);
  return pts;
})();
const KNOB = [DOOR_R - 75, 1080];
const AT_YOU = [-52, 6];
const AT_HAND = [-80, -40];
const AT_FORM = [0, 0];
const AT_FIELD = [14, 34];
const INTRO_LOOKS = [
  [1.9, -30, -20],
  [2.9, ...AT_YOU],
  [4.3, ...AT_HAND],
  [5.6, ...AT_YOU],
  [8.6, ...AT_FORM],
];
const IDLE = 12;
const IDLE_WAVE = 6.0;
const IDLE_LOOKS = [
  [0.4, ...AT_FORM],
  [3.0, 18, 30],
  [4.2, ...AT_FORM],
  [6.2, ...AT_YOU],
  [7.4, ...AT_HAND],
  [8.8, ...AT_YOU],
  [11.0, ...AT_FORM],
];
const INTRO = 9.0;

// The door swings away from us on its left hinge, in perspective.
function proj([x, y], th) {
  const u = x - HINGE;
  const s = FOCAL / (FOCAL + u * Math.sin(th));
  return [HINGE + u * Math.cos(th) * s, CY + (y - CY) * s];
}
const pathOf = (pts, th, close = true) =>
  pts
    .map((pt, i) => {
      const [X, Y] = proj(pt, th);
      return (i ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
    })
    .join('') + (close ? 'Z' : '');

function wave(t) {
  if (t < 0 || t > 6.2) return { up: 0, w: 0, lag: 0 };
  const up = t < 1.1 ? ease.outBack(t / 1.1, 1.5) : t < 5.0 ? 1 : 1 - ease.inOut(seg(t, 5.0, 6.2));
  const env = clamp((t - 0.7) / 0.4) * clamp((4.9 - t) / 0.4);
  return { up, w: Math.sin((2 * Math.PI * (t - 0.7)) / 1.3) * env, lag: Math.sin((2 * Math.PI * (t - 0.88)) / 1.3) * env };
}

function look(t, looks, blinks) {
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < looks.length; i++) {
    const [tt, x, y] = looks[i];
    if (t < tt) break;
    const prev = i ? looks[i - 1] : [0, 0, 0];
    const k = ease.inOut(seg(t, tt, tt + 0.2));
    dx = lerp(prev[1], x, k);
    dy = lerp(prev[2], y, k);
  }
  let shut = 0;
  for (const bt of blinks) {
    const u = (t - bt) / 0.22;
    if (u > 0 && u < 1) shut = Math.sin(Math.PI * u);
  }
  return { dx, dy, shut };
}

function markup(p) {
  return `
<defs>
  <filter id="${p}Boil" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence id="${p}Turb" type="fractalNoise" baseFrequency="0.013" numOctaves="1" seed="1"/>
    <feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="${p}Shade" x="-10%" y="-10%" width="120%" height="120%">
    <feComponentTransfer>
      <feFuncR id="${p}ShR" type="linear" slope="1"/><feFuncG id="${p}ShG" type="linear" slope="1"/><feFuncB id="${p}ShB" type="linear" slope="1"/>
    </feComponentTransfer>
  </filter>
  <mask id="${p}EyeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1448" height="2000">
    <image href="${eyeMask}" x="0" y="0" width="1448" height="2000"/>
  </mask>
  <g id="${p}Glove" stroke="#1e043e" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" fill="#ffffff">
    <ellipse cx="22" cy="-100" rx="74" ry="68"/>
    <rect x="-28" y="-248" width="50" height="128" rx="25" transform="rotate(-14 -3 -130)"/>
    <rect x="12" y="-262" width="50" height="142" rx="25" transform="rotate(2 37 -130)"/>
    <rect x="48" y="-238" width="48" height="118" rx="24" transform="rotate(18 72 -130)"/>
    <rect x="-30" y="-176" width="48" height="96" rx="24" transform="rotate(-62 -6 -110)"/>
    <ellipse cx="22" cy="-104" rx="62" ry="56" stroke="none"/>
    <path d="M2 -78 L2 -116 M24 -76 L24 -120 M46 -78 L46 -116" fill="none" stroke-width="12"/>
    <rect x="-46" y="-48" width="136" height="54" rx="27"/>
  </g>
</defs>
<ellipse id="${p}Shadow" cx="718" cy="1732" rx="330" ry="22" fill="#0b0226" opacity="0"/>
<g filter="url(#${p}Boil)">
  <image href="${doorway}" x="0" y="0" width="1448" height="2000"/>
  <g id="${p}Back"></g>
  <g>
    <path id="${p}DoorFace" fill="#fc9721" stroke="#1e043e" stroke-width="18" stroke-linejoin="round"/>
    <path id="${p}DoorPanel" fill="#dd7818" stroke="#1e043e" stroke-width="16" stroke-linejoin="round"/>
    <path id="${p}DoorShine" fill="none" stroke="#ffc46b" stroke-width="14" stroke-linecap="round" opacity=".8"/>
    <ellipse id="${p}KnobBody" fill="#ffd36e" stroke="#1e043e" stroke-width="12"/>
    <ellipse id="${p}KnobGlint" fill="#fff6dc"/>
  </g>
  <g id="${p}Front"></g>
  <g id="${p}Mascot" filter="url(#${p}Shade)">
    <g id="${p}Arm">
      <path class="o" fill="none" stroke="#1e043e" stroke-width="118" stroke-linecap="round"/>
      <path class="f" fill="none" stroke="#ffffff" stroke-width="82" stroke-linecap="round"/>
      <use href="#${p}Glove" class="g"/>
    </g>
    <g id="${p}Body"><image href="${body}" x="0" y="0" width="1448" height="2000"/></g>
    <g id="${p}Head">
      <image href="${head}" x="0" y="0" width="1448" height="2000"/>
      <g mask="url(#${p}EyeMask)">
        <g id="${p}Pupils">
          <circle cx="643.9" cy="1033.7" r="104.7" fill="#1b0338"/>
          <image href="${shineLeft}" x="633" y="945" width="87" height="175"/>
          <circle cx="990.8" cy="1020.4" r="107.8" fill="#1b0338"/>
          <image href="${shineRight}" x="980" y="930" width="86" height="178"/>
        </g>
        <g id="${p}Lids" visibility="hidden">
          <rect id="${p}Lid" x="400" y="860" width="720" height="0" fill="#b16ff6"/>
          <rect id="${p}LidLine" x="400" y="860" width="720" height="20" fill="#1e043e"/>
        </g>
      </g>
    </g>
  </g>
</g>`;
}

/**
 * The door greeting beside Log in and Create account. Decoration only (hidden from screen
 * readers). With Reduce motion or Quiet mode he stands outside the open door, still.
 */
export default function MascotDoor({ className = 'w-full', forceStill = false }) {
  const p = useSvgPrefix();
  const svgRef = useRef(null);
  const preferenceStill = useMascotStill();
  const still = forceStill || preferenceStill;

  useEffect(() => {
    const svg = svgRef.current;
    const $ = partFinder(svg, p);
    const el = { back: $('Back'), front: $('Front'), mascot: $('Mascot'), arm: $('Arm') };
    const shades = [$('ShR'), $('ShG'), $('ShB')];
    let inFront = null;
    let waveAt = 3.2;
    let lookOverride = null;

    function drawDoor(th, knobTurn) {
      $('DoorFace').setAttribute('d', pathOf(FACE, th));
      $('DoorPanel').setAttribute('d', pathOf(PANEL, th));
      $('DoorShine').setAttribute('d', pathOf(SHINE, th, false));
      const [kx, ky] = proj(KNOB, th);
      const s = FOCAL / (FOCAL + (KNOB[0] - HINGE) * Math.sin(th));
      const rx = 34 * Math.max(0.25, Math.cos(th)) * s;
      const ry = 34 * s;
      const knob = $('KnobBody');
      knob.setAttribute('cx', kx);
      knob.setAttribute('cy', ky);
      knob.setAttribute('rx', rx);
      knob.setAttribute('ry', ry);
      const ga = -2.3 + knobTurn;
      const glint = $('KnobGlint');
      glint.setAttribute('cx', kx + Math.cos(ga) * rx * 0.45);
      glint.setAttribute('cy', ky + Math.sin(ga) * ry * 0.45);
      glint.setAttribute('rx', rx * 0.28);
      glint.setAttribute('ry', ry * 0.28);
    }

    function setArm(shoulder, ctrl, wrist, rot, scale, hidden) {
      const d = `M${shoulder[0]} ${shoulder[1]} Q${ctrl[0]} ${ctrl[1]} ${wrist[0]} ${wrist[1]}`;
      el.arm.querySelector('.o').setAttribute('d', d);
      el.arm.querySelector('.f').setAttribute('d', d);
      const glove = el.arm.querySelector('.g');
      glove.style.visibility = hidden ? 'hidden' : 'visible';
      glove.setAttribute('transform', `translate(${wrist[0]} ${wrist[1]}) rotate(${rot}) scale(${-scale} ${scale})`);
    }

    function frame(t) {
      const rattle = t > 0.35 && t < 0.85 ? Math.sin((t - 0.35) * Math.PI * 6) * 0.03 * (1 - seg(t, 0.35, 0.85)) : 0;
      const swing = t < 0.9 ? 0 : t < 1.9 ? ease.outBack(seg(t, 0.9, 1.9), 1.3) : 1;
      const th = Math.max(0, rattle) + swing * ((77.5 * Math.PI) / 180);
      drawDoor(th, t > 0.35 && t < 0.85 ? -Math.sin(seg(t, 0.35, 0.85) * Math.PI) * 1.2 : 0);

      const p2 = seg(t, 2.0, 2.9);
      const hop = Math.abs(Math.sin(p2 * Math.PI * 2)) * 70 * (1 - p2 * 0.3);
      const depth = lerp(0.6, 1, ease.inOut(p2));
      const land = t > 2.9 && t < 3.25 ? Math.sin(seg(t, 2.9, 3.25) * Math.PI) : 0;
      const shade = lerp(0.5, 1, ease.out(p2)).toFixed(3);
      shades.forEach((f) => f.setAttribute('slope', shade));
      const front = t >= 1.95;
      if (front !== inFront) {
        (front ? el.front : el.back).appendChild(el.mascot);
        inFront = front;
      }

      const ph = (t / 2.6) % 1;
      const b = Math.sin(2 * Math.PI * ph);
      const bl = Math.sin(2 * Math.PI * (ph - 0.07));
      const wv = wave(t - waveAt);
      const s = 1 + 0.014 * b + 0.006 * wv.up - 0.06 * land;
      const sx = 1 / Math.sqrt(s);
      const rise = BODY_H * (s - 1);
      el.mascot.setAttribute(
        'transform',
        `translate(${FEET[0]} ${FEET[1] - lerp(230, 0, ease.inOut(p2)) - hop}) scale(${depth}) translate(${-FEET[0]} ${-FEET[1]})`,
      );
      $('Body').setAttribute('transform', `translate(${FEET[0]} ${FEET[1]}) scale(${sx} ${s}) translate(${-FEET[0]} ${-FEET[1]})`);
      const tilt = 1.0 * bl - 1.6 * wv.up - 0.8 * wv.lag;
      $('Head').setAttribute('transform', `translate(0 ${-rise - 5 * Math.max(0, bl) - 8 * wv.up}) rotate(${tilt} ${NECK[0]} ${NECK[1]})`);
      $('Shadow').setAttribute('opacity', ((0.16 * ease.inOut(p2)) / s).toFixed(3));
      $('Shadow').setAttribute('rx', 330 / s);

      const shY = lerp(1322, 1345, wv.up) - rise * 0.8;
      const rest = { c: [432, 1392], w: [470, 1440], r: -210 };
      const up = { c: [215, 1360], w: [228, 1050], r: 8 };
      const wr = [lerp(rest.w[0], up.w[0], wv.up) - 12 * wv.w, lerp(rest.w[1], up.w[1], wv.up) + 5 * Math.abs(wv.w)];
      const cr = [lerp(rest.c[0], up.c[0], wv.up) + 22 * wv.lag, lerp(rest.c[1], up.c[1], wv.up)];
      setArm([468, shY], cr, wr, lerp(rest.r, up.r, wv.up) - 18 * wv.w, 1.0, wv.up < 0.12);

      const e = lookOverride
        ? { dx: lookOverride[0], dy: lookOverride[1], shut: 0 }
        : t < INTRO
          ? look(t, INTRO_LOOKS, [1.2, 6.8])
          : look((t - INTRO) % IDLE, IDLE_LOOKS, [2.2, 9.9]);
      $('Pupils').setAttribute('transform', `translate(${e.dx.toFixed(1)} ${e.dy.toFixed(1)})`);
      $('Lids').setAttribute('visibility', e.shut > 0 ? 'visible' : 'hidden');
      const lh = 290 * e.shut;
      $('Lid').setAttribute('height', lh);
      $('LidLine').setAttribute('y', 860 + lh - 10);

      if (t >= INTRO) {
        const k = Math.floor((t - INTRO) / IDLE);
        const at = INTRO + k * IDLE + IDLE_WAVE;
        if (t >= at) waveAt = Math.max(waveAt, at);
      }
      $('Turb').setAttribute('seed', 1 + (Math.floor(t * 6) % 4));
    }

    if (still) {
      frame(INTRO + 4);
      $('Turb').setAttribute('seed', 1);
      return undefined;
    }

    // He glances at whichever form field has focus.
    const onFocusIn = (event) => {
      if (event.target.matches?.('input, select, textarea')) lookOverride = AT_FIELD;
    };
    const onFocusOut = () => {
      lookOverride = null;
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    frame(0);
    const stopClock = runClock(svg, FPS, frame);
    return () => {
      stopClock();
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [p, still]);

  return (
    <svg
      ref={svgRef}
      viewBox="60 230 1320 1530"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto overflow-visible ${className}`}
      dangerouslySetInnerHTML={{ __html: markup(p) }}
    />
  );
}
