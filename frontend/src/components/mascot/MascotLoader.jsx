import { useEffect, useRef } from 'react';
import arm from '../../assets/mascot-loader/arm.webp';
import head from '../../assets/mascot-loader/head.webp';
import shoeFar from '../../assets/mascot-loader/shoe-far.webp';
import shoeNear from '../../assets/mascot-loader/shoe-near.webp';
import torso from '../../assets/mascot-loader/torso.webp';
import { partFinder, runClock, useSvgPrefix } from './svgIds.js';
import useMascotStill from './useMascotStill.js';

// The stroll from mascot-loader.html (animation only): the mascot walks briskly in place while
// clouds, hills and the road scroll past. Screen space 1600 × 900; ground at y 780.
const GY = 780;
const KM = 0.36;
const RUN_X = 600;
const FOOT = [700, 1208];
const V = 400;
const RATE = 2.1;
const FPS = 30;
const NECK = [690, 818];
const SHOULDER = [560, 846];
const SHOE_N = [650, 975];
const SHOE_F = [895, 975];
const CLOUDS = [
  [200, 170, 1],
  [700, 120, 0.8],
  [1150, 200, 1.1],
  [1500, 140, 0.9],
];

function hillPath(y, amp, w) {
  let d = `M0 ${GY}`;
  for (let x = 0; x <= 1600; x += w) d += ` Q${x + w / 2} ${y - amp * ((x / w) % 2 ? 0.6 : 1)} ${x + w} ${GY}`;
  return `${d} Z`;
}

function markup(p) {
  const far = hillPath(650, 90, 420);
  const near = hillPath(735, 45, 300);
  return `
<defs>
  <filter id="${p}Boil" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence id="${p}Turb" type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="1"/>
    <feDisplacementMap in="SourceGraphic" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <path id="${p}CloudShape" d="M0 0 a46 46 0 0 1 70-38 a60 60 0 0 1 112 6 a44 44 0 0 1 58 32 z"/>
</defs>
<g fill="var(--od-surface-page)" stroke="var(--od-border-subtle)" stroke-width="4">
  ${CLOUDS.map((_, i) => `<use id="${p}Cloud${i}" href="#${p}CloudShape"/>`).join('')}
</g>
<g fill="var(--od-surface-tint)" stroke="var(--od-text-default)" stroke-width="5">
  <path id="${p}Far0" d="${far}"/><path id="${p}Far1" d="${far}"/>
</g>
<g fill="var(--od-surface-current)" stroke="var(--od-text-default)" stroke-width="5">
  <path id="${p}Near0" d="${near}"/><path id="${p}Near1" d="${near}"/>
</g>
<rect x="-2000" y="${GY}" width="5600" height="300" fill="var(--od-surface-subtle)"/>
<path d="M-2000 ${GY} H3600" stroke="var(--od-text-default)" stroke-width="6"/>
<g stroke="var(--od-border-subtle)" stroke-width="10" stroke-linecap="round">
  ${Array.from({ length: 9 }, (_, i) => `<path id="${p}Dash${i}"/>`).join('')}
</g>
<g filter="url(#${p}Boil)">
  <g id="${p}Runner">
    <g id="${p}BodyG"><g><image href="${arm}" x="442" y="804" width="219" height="247"/></g></g>
    <g id="${p}Far"><image href="${shoeFar}" x="708" y="943" width="374" height="251" style="filter:brightness(.88)"/></g>
    <g id="${p}BodyG2">
      <image href="${torso}" x="594" y="784" width="332" height="233"/>
      <g id="${p}Head"><image href="${head}" x="306" y="30" width="746" height="794"/></g>
    </g>
    <g id="${p}Near"><image href="${shoeNear}" x="411" y="942" width="479" height="273"/></g>
  </g>
</g>`;
}

// One stride: feet circle opposite each other, a springy bounce on every step, a little rock.
function stride(ph, amt = 1) {
  const a = ph * Math.PI * 2;
  const foot = (b) => [100 * Math.cos(b) * amt, -30 * Math.pow(Math.max(0, -Math.sin(b)), 1.4) * amt, 12 * Math.sin(-b) * amt];
  const spring = Math.pow(Math.abs(Math.sin(a)), 1.6);
  return {
    n: foot(a),
    f: foot(a + Math.PI),
    bodyY: -26 * spring * amt,
    arm: 26 * Math.cos(a + Math.PI) * amt,
    head: (3.5 * Math.sin(2 * a - 0.6) + 2 * Math.sin(a)) * amt,
    rock: 3.5 * Math.sin(a) * amt,
  };
}

/**
 * The loading picture: the mascot strolling along while the scenery scrolls past. Decoration only
 * (the words beside it are the status screen readers hear). With Reduce motion or Quiet mode he
 * stands still on the road.
 */
export default function MascotLoader({ className = 'w-72' }) {
  const p = useSvgPrefix();
  const svgRef = useRef(null);
  const still = useMascotStill();

  useEffect(() => {
    const svg = svgRef.current;
    const $ = partFinder(svg, p);
    const clouds = CLOUDS.map(([x, y, s], i) => ({ x, y, s, el: $(`Cloud${i}`) }));
    const wrap = (x, w) => ((x % w) + w) % w;

    function scenery(scroll) {
      for (const c of clouds) c.el.setAttribute('transform', `translate(${wrap(c.x - scroll * 0.12, 1900) - 150} ${c.y}) scale(${c.s})`);
      [0, 1].forEach((i) => {
        $(`Far${i}`).setAttribute('transform', `translate(${wrap(-scroll * 0.25, 1600) - 1600 * (1 - i)} 0)`);
        $(`Near${i}`).setAttribute('transform', `translate(${wrap(-scroll * 0.5, 1560) - 1560 * (1 - i)} 0)`);
      });
      for (let i = 0; i < 9; i++) $(`Dash${i}`).setAttribute('d', `M${wrap(i * 200 - scroll, 1800) - 100} 830 h70`);
    }

    function rig(o) {
      $('Runner').setAttribute('transform', `translate(${o.x} ${o.y}) scale(${KM}) rotate(${o.lean}) translate(${-FOOT[0]} ${-FOOT[1]})`);
      $('BodyG').setAttribute('transform', `translate(0 ${o.bodyY}) rotate(${o.arm} ${SHOULDER[0]} ${SHOULDER[1]})`);
      $('BodyG2').setAttribute('transform', `translate(0 ${o.bodyY})`);
      $('Head').setAttribute('transform', `rotate(${o.head} ${NECK[0]} ${NECK[1]})`);
      const shoe = (el, base, [dx, dy, r]) => el.setAttribute('transform', `translate(${dx} ${dy}) rotate(${r} ${base[0]} ${base[1] + 120})`);
      shoe($('Near'), SHOE_N, o.n);
      shoe($('Far'), SHOE_F, o.f);
    }
    if (still) {
      scenery(0);
      rig({ ...stride(0, 0), x: RUN_X, y: GY, lean: 0 });
      return undefined;
    }

    let last = 0;
    let scroll = 0;
    let phase = 0;
    return runClock(svg, FPS, (t) => {
      const dt = Math.min(0.05, t - last);
      last = t;
      scroll += V * dt;
      phase = (phase + dt * RATE) % 1;
      scenery(scroll);
      const o = stride(phase);
      rig({ ...o, x: RUN_X, y: GY, lean: 3 + o.rock });
      $('Turb').setAttribute('seed', 1 + (Math.floor(t * 8) % 4));
    });
  }, [p, still]);

  return (
    <svg
      ref={svgRef}
      viewBox="250 300 800 560"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className={`block h-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: markup(p) }}
    />
  );
}
