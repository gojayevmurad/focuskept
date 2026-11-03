const numberCache = new Map<string, Intl.NumberFormat>();
function two(locale: string) {
  let f = numberCache.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    });
    numberCache.set(locale, f);
  }
  return f;
}

/** Timer digits (m:ss / h:mm:ss) in the locale's numbering system. */
export function formatClock(ms: number, locale: string) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const f = two(locale);
  return h > 0
    ? `${new Intl.NumberFormat(locale).format(h)}:${f.format(m)}:${f.format(s)}`
    : `${f.format(m)}:${f.format(s)}`;
}

/** Human duration, e.g. "1 h 25 min" / "1 Std. 25 Min.", via Intl. */
export function formatMinutes(minutes: number, locale: string) {
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const unit = (value: number, unitName: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: unitName,
      unitDisplay: "short",
    }).format(value);
  if (h === 0) return unit(m, "minute");
  if (m === 0) return unit(h, "hour");
  return `${unit(h, "hour")} ${unit(m, "minute")}`;
}
