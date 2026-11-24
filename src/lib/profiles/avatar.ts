// SPDX-License-Identifier: AGPL-3.0-only
export const MAX_AVATAR_BYTES = 300 * 1024;
export function avatarType(bytes: Uint8Array): string | null {
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
