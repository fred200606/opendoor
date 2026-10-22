import { useId, useState } from 'react';

/**
 * A chart's card: title, one-line subtitle, the chart, and its accessible twin – a "Show as a
 * table" toggle with the same numbers (tooltips and colours never gate a value).
 * `table` = { caption, columns: [label], rows: [[cell, …]] }; `empty` replaces the chart when there
 * is nothing to plot yet.
 */
export default function ChartCard({ title, subtitle, table, empty, children }) {
  const titleId = useId();
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="chart-card od rounded-lg border-2 border-border bg-surface p-5 sm:p-6" aria-labelledby={titleId}>
      <div className="chart-card__head">
        <div>
          <h2 id={titleId} className="chart-card__title">
            {title}
          </h2>
          {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
        </div>
        {table && !empty && (
          <button
            type="button"
            className="button button--secondary button--small"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((shown) => !shown)}
          >
            {showTable ? 'Hide the table' : 'Show as a table'}
          </button>
        )}
      </div>
      <div className="chart-card__body">{empty ? <p>{empty}</p> : children}</div>
      {table && !empty && (
        <div id={tableId} hidden={!showTable}>
          <table className="chart-table">
            <caption>{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={index}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

/** Legend: the key mirrors the mark (`line` or bar). Text stays in ink. */
export function ChartLegend({ items, mark = 'bar' }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`chart-key ${mark === 'line' ? 'chart-key--line' : ''}`.trim()} style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
