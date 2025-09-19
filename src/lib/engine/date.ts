
export const toYMD = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
    .toISOString()
    .slice(0, 10); // yyyy-mm-dd
};

export const toMidnightUTC = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export const addDaysYmd = (ymd: string, days: number) =>
  toYMD(new Date(Date.parse(ymd) + days * 86400000));

export function nightsBetweenInclusive(startYmd: string, endInclusiveYmd: string) {
  const s = toMidnightUTC(startYmd).getTime();
  const e = toMidnightUTC(endInclusiveYmd).getTime();
  const nights = Math.max(1, Math.round((e - s) / 86400000) || 1);
  return nights;
}
