export type Bar = {
  key: string;
  /** Short axis label (e.g. weekday or hour). */
  label: string;
  value: number;
  /** Already formatted value for tooltips and the table. */
  display: string;
  /** Optional secondary series value (0–1 scale of the bar), e.g. goal or rating. */
  muted?: boolean;
};

/**
 * Bars laid out with CSS grid, so they follow the reading direction (RTL)
 * and theme tokens automatically. The visual is hidden from assistive tech;
 * the same data is available as a table.
 */
export function BarChart({
  bars,
  caption,
  tableLabel,
  columns,
  height = 140,
}: {
  bars: Bar[];
  caption: string;
  tableLabel: string;
  columns: [string, string];
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="stack" style={{ gap: 8, margin: 0 }}>
      <figcaption className="label">{caption}</figcaption>
      <div
        className="bars"
        style={{
          gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
          height,
        }}
        aria-hidden="true"
      >
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="bar-col"
            title={`${bar.label}: ${bar.display}`}
          >
            <span
              className={bar.muted ? "bar-fill is-muted" : "bar-fill"}
              style={{
                blockSize: `${Math.max(bar.value > 0 ? 3 : 0, (bar.value / max) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="bars-labels"
        style={{
          gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
        }}
        aria-hidden="true"
      >
        {bars.map((bar) => (
          <span key={bar.key}>{bar.label}</span>
        ))}
      </div>
      <details>
        <summary className="hint" style={{ cursor: "pointer" }}>
          {tableLabel}
        </summary>
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.label}</th>
                <td className="tabular">{bar.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
