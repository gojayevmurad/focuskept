// SPDX-License-Identifier: AGPL-3.0-only
export function addTag(tags: string[], input: string) {
  const tag = input.trim().replace(/\s+/g, " ").toLowerCase();
  if (
    !tag ||
    tag.length > 24 ||
    tags.length >= 5 ||
    tags.some((t) => t.toLocaleLowerCase() === tag.toLocaleLowerCase())
  )
    return tags;
  return [...tags, tag];
}
export function validTags(tags: string[]) {
  return (
    tags.length <= 5 &&
    tags.every((t) => t === t.trim() && t.length > 0 && t.length <= 24) &&
    new Set(tags.map((t) => t.toLowerCase())).size === tags.length
  );
}
