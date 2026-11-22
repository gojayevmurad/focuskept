// SPDX-License-Identifier: AGPL-3.0-only
import process from "node:process";

const key = process.env.INDEXNOW_KEY;
const appUrl = process.env.APP_URL || "http://localhost:3000";

if (!key) {
  console.log("IndexNow: skipped (INDEXNOW_KEY is not set).");
  process.exit(0);
}

const host = new URL(appUrl).hostname;
const keyLocation = new URL("/indexnow-key.txt", appUrl).toString();

const cliUrls = process.argv.slice(2).filter((u) => u.startsWith("http"));
const defaultUrls = [
  new URL("/", appUrl).toString(),
  new URL("/how-it-works", appUrl).toString(),
  new URL("/faq", appUrl).toString(),
  new URL("/blog", appUrl).toString(),
  new URL("/body-doubling-for", appUrl).toString(),
  new URL("/study-with-me", appUrl).toString(),
  new URL("/virtual-coworking-for", appUrl).toString(),
  new URL("/alternatives", appUrl).toString(),
];

const urls = cliUrls.length > 0 ? cliUrls : defaultUrls;

console.log(`IndexNow: submitting ${urls.length} URLs for ${host}...`);

const payload = {
  host,
  key,
  keyLocation,
  urlList: urls,
};

try {
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok || response.status === 202) {
    console.log(
      `IndexNow: success (${response.status} ${response.statusText}).`,
    );
    process.exit(0);
  } else {
    console.error(
      `IndexNow: error (${response.status} ${response.statusText}).`,
    );
    process.exit(1);
  }
} catch (err) {
  console.error("IndexNow: request failed:", err);
  process.exit(1);
}
