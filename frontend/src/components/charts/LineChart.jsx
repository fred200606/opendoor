import { useEffect, useRef, useState } from 'react';
import { ChartLegend } from './ChartCard.jsx';

const HEIGHT = 220;
const MARGIN = { top: 12, right: 40, bottom: 28, left: 36 };
const FALLBACK_WIDTH = 640; // before the first measurement (and in tests: no ResizeObserver)

/** Width of an element, kept up to date. */
function useWidth(ref) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** 0 → ~4 clean ticks (1, 2, 5 × 10ⁿ steps). */
function ticksFor(max) {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough);
  const ticks = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}

/**
 * Multi-series line chart over shared x positions (a few series, one axis). 2px lines, a legend,
 * the last value labelled at each line's end, and a crosshair that snaps to the nearest position on
 * hover; the plot is a focusable slider whose arrow keys move the crosshair (the value text reads the week).
 * `points` = [{ label, values: { [seriesKey]: number } }]; `series` = [{ key, label, color }].
 */
export default function LineChart({ points, series, describe }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ticks = ticksFor(Math.max(0, ...points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0))));
  const top = ticks[ticks.length - 1];
  const x = (index) => MARGIN.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  // Label every n-th week so the labels never collide (about 56 px each).
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 56))));
  const last = points.length - 1;
  // End labels only while the line ends are apart; otherwise the legend, crosshair and table carry them.
  const ends = series.map((item) => y(points[last].values[item.key] ?? 0));
  const labelEnds = ends.every((end, index) => ends.every((other, j) => j === index || Math.abs(end - other) >= 14));

  function nearest(clientX) {
    const box = wrapRef.current.getBoundingClientRect();
    const ratio = (clientX - box.left - MARGIN.left) / plotWidth;
    return Math.min(last, Math.max(0, Math.round(ratio * last)));
  }

  function onKeyDown(event) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const from = active ?? last;
    setActive(Math.min(last, Math.max(0, from + moves[event.key])));
  }

  const readout = active === null ? '' : `${points[active].label}: ${series.map((item) => `${item.label} ${points[active].values[item.key] ?? 0}`).join(', ')}`;

  return (
    <div className="line-chart">
      <ChartLegend items={series} mark="line" />
      <div ref={wrapRef} style={{ position: 'relative', minWidth: 0 }}>
        <svg
          className="line-chart__plot"
          width={width}
          height={HEIGHT}
          // The crosshair is a slider over the weeks: the value text reads every series of that week.
          role="slider"
          aria-label={describe}
          aria-roledescription="chart"
          aria-valuemin={1}
          aria-valuemax={points.length}
          aria-valuenow={(active ?? last) + 1}
          aria-valuetext={readout || `${points[last].label}. Use the arrow keys to read each week.`}
          tabIndex={0}
          onPointerMove={(event) => setActive(nearest(event.clientX))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? last)}
          onBlur={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--viz-grid)" strokeWidth="1" />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {points.map((point, index) =>
            index % every === (last % every) ? (
              <text key={point.label} x={x(index)} y={HEIGHT - 8} textAnchor={index === 0 ? 'start' : index === last ? 'end' : 'middle'}>
                {point.short ?? point.label}
              </text>
            ) : null,
          )}
          {series.map((item) => (
            <polyline
              key={item.key}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((point, index) => `${x(index)},${y(point.values[item.key] ?? 0)}`).join(' ')}
            />
          ))}
          {/* The last value at each line's end (end dot with a surface ring). */}
          {series.map((item) => (
            <g key={item.key}>
              <circle cx={x(last)} cy={y(points[last].values[item.key] ?? 0)} r="4" fill={item.color} stroke="var(--viz-surface)" strokeWidth="2" />
              {labelEnds && (
                <text className="line-chart__end" x={x(last) + 8} y={y(points[last].values[item.key] ?? 0)} dy="0.32em">
                  {points[last].values[item.key] ?? 0}
                </text>
              )}
            </g>
          ))}
          {active !== null && (
            <g aria-hidden="true">
              <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--viz-axis)" strokeWidth="1" />
              {series.map((item) => (
                <circle key={item.key} cx={x(active)} cy={y(points[active].values[item.key] ?? 0)} r="5" fill={item.color} stroke="var(--viz-surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {active !== null && (
          <div
            className="chart-tooltip"
            aria-hidden="true"
            style={{ left: Math.min(Math.max(0, x(active) - 80), Math.max(0, width - 176)), top: -8, transform: 'translateY(-100%)' }}
          >
            <p className="chart-tooltip__title">{points[active].label}</p>
            {series.map((item) => (
              <p key={item.key} className="chart-tooltip__row">
                <span className="chart-key chart-key--line" style={{ background: item.color }} />
                <strong>{points[active].values[item.key] ?? 0}</strong> {item.label}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
