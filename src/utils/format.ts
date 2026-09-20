export function formatPeso(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-PH");
}
