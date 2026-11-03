# Third-party notices

FocusKept uses open-source software. This file credits code copied into this repository and calls out dependencies whose licenses need attention. Dependencies are installed by the package manager and are not committed; each keeps its own license, which `pnpm licenses list` reports in full.

## Code in this repository

### Create Next App

The project was scaffolded with [Create Next App](https://github.com/vercel/next.js) under the MIT License.

```text
Copyright (c) 2025 Vercel, Inc.
```

### shadcn/ui

`src/components/ui` follows [shadcn/ui](https://github.com/shadcn-ui/ui) components under the MIT License.

```text
Copyright (c) 2023 shadcn
```

### MIT License text

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Dependencies to note

| Package                                       | License               | Note                                                                      |
| --------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `sentry` (CLI, installed by `@sentry/nextjs`) | FSL-1.1-Apache-2.0    | Not an open-source license. Use is allowed unless it competes with Sentry |
| `@img/sharp-libvips-*` (installed by `sharp`) | LGPL-3.0-or-later     | Prebuilt library. Published Docker images must carry its notices          |
| `web-push`, `lightningcss`, `axe-core`        | MPL-2.0               | Used unmodified                                                           |
| `dompurify`                                   | MPL-2.0 or Apache-2.0 | Used under Apache-2.0                                                     |
| `caniuse-lite`                                | CC-BY-4.0             | Browser data by the Can I Use project                                     |

## Fonts

Onest, Geist Mono and the Noto Sans families are licensed under the SIL Open Font License 1.1. They are downloaded during the build and are not committed.

## Trademarks

Pomodoro Technique® is a trademark of Francesco Cirillo. FocusKept is not affiliated with, associated with, or endorsed by the Pomodoro Technique® or Francesco Cirillo. Next.js and Vercel are trademarks of Vercel, Inc.
