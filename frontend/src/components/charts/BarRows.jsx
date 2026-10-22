import { percent } from '../../lib/format.js';
import { ChartLegend } from './ChartCard.jsx';

/**
 * Horizontal bars, one row per category, the value at each bar's tip (no tooltip needed: every
 * value is printed). Bars are at most 16 px thick with a 4 px rounded end and grow from one
 * baseline. With several `series` each row gets a bar per series (2 px apart) and a legend.
 * `rows` = [{ label, bars: [{ value (0–1 share of the track), text, detail? }] }].
 */
export default function BarRows({ rows, series }) {
  return (
    <>
      {series.length > 1 && <ChartLegend items={series} />}
      <ul className="bar-rows">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="bar-row__label">{row.label}</div>
            <div className="bar-row__bars">
              {row.bars.map((bar, index) => (
                <div key={series[index].label} className="bar-row__line">
                  {/* The value sits at the bar's tip: the bar takes its share of the row minus the label room. */}
                  <span
                    className="bar-row__bar"
                    aria-hidden="true"
                    style={{ width: `calc((100% - var(--bar-label-room)) * ${Math.max(0, Math.min(1, bar.value))})`, background: series[index].color }}
                  />
                  <span className="bar-row__value">
                    {series.length > 1 && <span className="visually-hidden">{series[index].label}: </span>}
                    {bar.text} {bar.detail && <span>{bar.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * One 100% bar split into ordered parts (2 px surface gaps), with the parts listed below it –
 * swatch, label, count and share – so no value depends on colour or hover.
 * `parts` = [{ label, count, color }].
 */
export function StackedBar({ parts }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  return (
    <>
      <div className="stacked-bar" aria-hidden="true">
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <span key={part.label} className="stacked-bar__segment" style={{ flexGrow: part.count, background: part.color }} />
          ))}
      </div>
      <ul className="chart-legend">
        {parts.map((part) => (
          <li key={part.label}>
            <span className="chart-key" style={{ background: part.color }} aria-hidden="true" />
            <span>
              {part.label}: <strong>{percent(part.count, total)}</strong> ({part.count})
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
