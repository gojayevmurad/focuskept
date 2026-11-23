# Font provenance

Original variable TrueType binaries were retrieved from the public `google/fonts` repository via its file API on 23 November 2026. They are not reconstructed from a screenshot or browser font cache.

| Local original              | Family/version                                             | Exact upstream Git blob                    | Notice                 |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `Figtree-variable.ttf`      | Figtree, version 2.002, weight axis                        | `579e2ab5f30beb21cd0b618dd0796b0fce0eff8e` | `Figtree-OFL.txt`      |
| `BigShoulders-variable.ttf` | Big Shoulders, version 2.002, optical size and weight axes | `e26f6dd3335e84ed94227519d08256d526c01124` | `BigShoulders-OFL.txt` |

Upstream locations: [Figtree](https://github.com/google/fonts/tree/main/ofl/figtree) and [Big Shoulders](https://github.com/google/fonts/tree/main/ofl/bigshoulders). Both original license notices are preserved verbatim.

The logo wordmark uses Figtree at weight 750 with a documented custom tracking schedule. It is not an independently designed typeface. Outlined master artwork has no runtime font dependency. HarfBuzz produces static Figtree 400/500/600 and Big Shoulders 700 at optical size 28 in `../exports/fonts/`; the app's next/og renderers (OG image and share cards) load Figtree 400/600 and Big Shoulders 700 from there at runtime, and the Docker build traces them into the standalone output. Those files retain OFL licensing. Font subsets, derived instances, and original font software are not relabeled as AGPL.
