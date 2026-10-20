import { useEffect, useId, useRef } from 'react';
import useMascotStill from '../mascot/useMascotStill.js';
import body from '../../assets/mascot/body.webp';
import eyeMask from '../../assets/mascot/eye-mask.png';
import head from '../../assets/mascot/head.webp';
import shineLeft from '../../assets/mascot/shine-left.png';
import shineRight from '../../assets/mascot/shine-right.png';

// The animated briefcase mascot of the IPT look (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b). The drawing is three images (body, head,
// eye mask); the script moves them like an old cartoon: an idle bounce, a wave every 11 seconds,
// darting eyes, blinks and a hand-drawn "line boil", drawn at 24 frames a second.
const FEET = [968, 1668]; // the body squashes from here
const BODY_H = 570; // feet to neck
const NECK = [960, 1150]; // the head turns around this point
const LOOP = 11; // seconds per greeting
const BOB = 2.6; // seconds per idle bounce
const FPS = 24;
const STILL_POSE = 3.0; // mid-wave: how he stands when motion is off

const ease = {
  outBack: (t) => {
    const c = 1.5;
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// The greeting: raise the arm (with overshoot), three easy waves, lower it, then a long rest.
function greet(t) {
  const up = t < 0.6 ? 0 : t < 1.7 ? ease.outBack((t - 0.6) / 1.1) : t < 5.6 ? 1 : t < 6.8 ? 1 - ease.inOut((t - 5.6) / 1.2) : 0;
  const env = clamp((t - 1.3) / 0.4) * clamp((5.5 - t) / 0.4);
  const w = Math.sin((2 * Math.PI * (t - 1.3)) / 1.3) * env;
  const lag = Math.sin((2 * Math.PI * (t - 1.3 - 0.18)) / 1.3) * env;
  return { up, w, lag };
}

// Eyes hold a look, then dart to the next (cartoon eyes snap, they don't drift).
const LOOKS = [
  [0.0, 0, 0],
  [0.55, -60, -38],
  [2.3, -100, -62],
  [3.7, -60, -38],
  [7.0, 0, 0],
  [8.7, -40, 18],
  [10.1, 0, 0],
];
const BLINKS = [4.5, 9.4];

function look(t) {
  let dx = LOOKS[LOOKS.length - 1][1];
  let dy = LOOKS[LOOKS.length - 1][2];
  for (let i = 0; i < LOOKS.length; i++) {
    const [tt, x, y] = LOOKS[i];
    if (t < tt) break;
    const prev = LOOKS[(i + LOOKS.length - 1) % LOOKS.length];
    const k = ease.inOut(clamp((t - tt) / 0.2));
    dx = lerp(prev[1], x, k);
    dy = lerp(prev[2], y, k);
  }
  let shut = 0;
  for (const bt of BLINKS) {
    const u = (t - bt) / 0.22;
    if (u > 0 && u < 1) shut = Math.sin(Math.PI * u);
  }
  return { dx, dy, shut };
}

/**
 * Decoration: hidden from screen readers, since the heading beside it says what the page is.
 * It moves only while on screen, and holds still with Reduce motion (the system setting or
 * Account → Display) and in Quiet mode.
 */
export default function Mascot({ className = '' }) {
  const still = useMascotStill();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = { boil: `${uid}-boil`, turb: `${uid}-turb`, glove: `${uid}-glove`, eyes: `${uid}-eyes` };
  const refs = useRef({});
  const set = (name) => (el) => {
    refs.current[name] = el;
  };

  useEffect(() => {
    const { stage, body: bodyEl, head: headEl, shadow, turb, arm, pupils, lids, lid, lidLine } = refs.current;

    function drawArm(shoulder, ctrl, wrist, rot, scale, hidden) {
      const d = `M${shoulder[0]} ${shoulder[1]} Q${ctrl[0]} ${ctrl[1]} ${wrist[0]} ${wrist[1]}`;
      arm.querySelector('.o').setAttribute('d', d);
      arm.querySelector('.f').setAttribute('d', d);
      const glove = arm.querySelector('.g');
      glove.style.visibility = hidden ? 'hidden' : 'visible';
      glove.setAttribute('transform', `translate(${wrist[0]} ${wrist[1]}) rotate(${rot}) scale(${-scale} ${scale})`);
    }

    function frame(t) {
      const g = greet(t % LOOP);
      // Idle bounce: a gentle stretch and settle, faster down than up.
      const ph = (t / BOB) % 1;
      const b = Math.sin(2 * Math.PI * ph);
      const bl = Math.sin(2 * Math.PI * (ph - 0.07));
      const s = 1 + 0.014 * b + 0.006 * g.up;
      const sx = 1 / Math.sqrt(s);
      const rise = BODY_H * (s - 1);

      bodyEl.setAttribute('transform', `translate(${FEET[0]} ${FEET[1]}) scale(${sx} ${s}) translate(${-FEET[0]} ${-FEET[1]})`);
      const tilt = 1.1 * bl - 1.6 * g.up - 0.8 * g.lag; // leans toward the waving arm
      const headLift = -rise - 6 * Math.max(0, bl) - 10 * g.up;
      headEl.setAttribute('transform', `translate(0 ${headLift}) rotate(${tilt} ${NECK[0]} ${NECK[1]})`);
      shadow.setAttribute('rx', 540 / s);
      shadow.setAttribute('opacity', (0.13 / s).toFixed(3));

      // His left arm: tucked behind his back at rest, swings out and up to wave.
      const shY = lerp(1150, 1188, g.up) - rise * 0.8;
      const rest = { c: [518, 1262], w: [558, 1332], r: -210 };
      const up = { c: [116, 1300], w: [68, 985], r: 8 };
      const wrist = [lerp(rest.w[0], up.w[0], g.up) - 14 * g.w, lerp(rest.w[1], up.w[1], g.up) + 6 * Math.abs(g.w)];
      const ctrl = [lerp(rest.c[0], up.c[0], g.up) + 26 * g.lag, lerp(rest.c[1], up.c[1], g.up)];
      drawArm([552, shY], ctrl, wrist, lerp(rest.r, up.r, g.up) - 18 * g.w, 1.35, g.up < 0.12);

      const e = look(t % LOOP);
      pupils.setAttribute('transform', `translate(${e.dx.toFixed(1)} ${e.dy.toFixed(1)})`);
      lids.setAttribute('visibility', e.shut > 0 ? 'visible' : 'hidden');
      const lh = 470 * e.shut;
      lid.setAttribute('height', lh);
      lidLine.setAttribute('y', 440 + lh - 12);

      turb.setAttribute('seed', 1 + (Math.floor(t * 6) % 4)); // the line boils at 6 drawings a second
    }

    if (still) {
      frame(STILL_POSE);
      turb.setAttribute('seed', 1);
      return undefined;
    }

    let raf = 0;
    let last = -1;
    let onScreen = true;
    let t0 = null; // the first frame's time
    function loop(now) {
      if (t0 === null) t0 = now;
      const q = Math.floor(((now - t0) / 1000) * FPS);
      if (q !== last) {
        last = q;
        frame(q / FPS);
      }
      raf = requestAnimationFrame(loop);
    }
    const start = () => {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    frame(0);
    start();
    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      });
      observer.observe(stage);
    }
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [still]);

  return (
    <div ref={set('stage')} aria-hidden="true" className={`relative aspect-[2050/1760] w-full ${className}`}>
      <svg viewBox="-140 0 2050 1760" className="absolute inset-0 size-full overflow-visible" focusable="false">
        <defs>
          {/* "Line boil": the hand-drawn wobble of 1930s cel animation. */}
          <filter id={ids.boil} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence ref={set('turb')} id={ids.turb} type="fractalNoise" baseFrequency="0.011" numOctaves="1" seed="1" />
            <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <g id={ids.glove} stroke="#0b0226" strokeWidth="18" strokeLinejoin="round" strokeLinecap="round" fill="#f9f5fd">
            <ellipse cx="22" cy="-100" rx="74" ry="68" />
            <rect x="-28" y="-248" width="50" height="128" rx="25" transform="rotate(-14 -3 -130)" />
            <rect x="12" y="-262" width="50" height="142" rx="25" transform="rotate(2 37 -130)" />
            <rect x="48" y="-238" width="48" height="118" rx="24" transform="rotate(18 72 -130)" />
            <rect x="-30" y="-176" width="48" height="96" rx="24" transform="rotate(-62 -6 -110)" />
            <ellipse cx="22" cy="-104" rx="62" ry="56" stroke="none" />
            <path d="M2 -78 L2 -116 M24 -76 L24 -120 M46 -78 L46 -116" fill="none" strokeWidth="12" />
            <rect x="-46" y="-48" width="136" height="54" rx="27" />
          </g>
          {/* The open part of each eye: pupils and lids are drawn only inside it. */}
          <mask id={ids.eyes} maskUnits="userSpaceOnUse" x="0" y="0" width="2000" height="1703">
            <image href={eyeMask} x="0" y="0" width="2000" height="1703" />
          </mask>
        </defs>
        <ellipse ref={set('shadow')} cx="968" cy="1676" rx="540" ry="34" fill="#0b0226" opacity=".13" />
        <g filter={`url(#${ids.boil})`}>
          <g ref={set('arm')}>
            <path className="o" fill="none" stroke="#0b0226" strokeWidth="148" strokeLinecap="round" />
            <path className="f" fill="none" stroke="#f9f5fd" strokeWidth="100" strokeLinecap="round" />
            <use href={`#${ids.glove}`} className="g" />
          </g>
          <g ref={set('body')}>
            <image href={body} x="0" y="0" width="2000" height="1703" />
          </g>
          <g ref={set('head')}>
            <image href={head} x="0" y="0" width="2000" height="1703" />
            <g mask={`url(#${ids.eyes})`}>
              <g ref={set('pupils')}>
                <circle cx="757.7" cy="772.4" r="199.8" fill="#2a0a4b" />
                <image href={shineLeft} x="776" y="743" width="100" height="134" />
                <circle cx="1319.6" cy="763.7" r="192.9" fill="#2a0a4b" />
                <image href={shineRight} x="1332" y="739" width="100" height="132" />
              </g>
              <g ref={set('lids')} visibility="hidden">
                <rect ref={set('lid')} x="380" y="440" width="1100" height="0" fill="#be7dfc" />
                <rect ref={set('lidLine')} x="380" y="440" width="1100" height="24" fill="#0b0226" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
