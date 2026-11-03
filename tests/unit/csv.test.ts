import { expect, it } from "vitest";
import { csvCell, toCsv } from "@/src/features/export/csv";

it("escapes CSV and neutralizes spreadsheet formulas", () => {
  expect(csvCell('He said "hi", then left')).toBe(
    '"He said ""hi"", then left"',
  );
  expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  expect(csvCell("-1+2")).toBe("'-1+2");
  expect(csvCell(null)).toBe("");
  expect(csvCell(new Date("2026-11-02T00:00:00Z"))).toBe(
    "2026-11-02T00:00:00.000Z",
  );
  expect(toCsv(["a", "b"], [{ a: 1, b: "x\ny" }])).toBe('﻿a,b\r\n1,"x\ny"\r\n');
});
