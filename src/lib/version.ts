// Version numbers such as "2.0.7", compared part by part. A missing part counts as zero.
export function isVersionAtLeast(version: string, minimum: string): boolean {
  const have = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const need = minimum.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(have.length, need.length);
  for (let index = 0; index < length; index += 1) {
    const a = have[index] ?? 0;
    const b = need[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}
