// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { getAppConfig } from "@/src/config/app";
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  body: string;
  html: string;
};
const directory = path.join(process.cwd(), "content", "blog");
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const markdown = new Marked({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});
export function parsePost(source: string, slug: string): BlogPost {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Missing frontmatter: ${slug}`);
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Invalid frontmatter: ${slug}`);
    const value = line.slice(separator + 1).trim();
    fields[line.slice(0, separator).trim()] = value.replace(
      /^("|')(.*)\1$/,
      "$2",
    );
  }
  for (const key of ["title", "description", "date", "author"]) {
    if (!fields[key]) throw new Error(`Missing ${key}: ${slug}`);
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.date) ||
    Number.isNaN(Date.parse(fields.date))
  )
    throw new Error(`Invalid date: ${slug}`);
  const name = getAppConfig().name;
  const replace = (value: string) => value.replaceAll("{app}", name);
  const body = replace(match[2].trim());
  return {
    slug,
    title: replace(fields.title),
    description: replace(fields.description),
    date: fields.date,
    author: replace(fields.author),
    body,
    html: markdown.parse(body, { async: false }),
  };
}
export function listBlogPosts(): BlogPost[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .map((file) =>
      parsePost(
        readFileSync(path.join(directory, file), "utf8"),
        file.slice(0, -3),
      ),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
    );
}
export function getBlogPost(slug: string) {
  return listBlogPosts().find((post) => post.slug === slug);
}
