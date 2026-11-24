# FocusKept brand work

Research date: 23 November 2026. Repository baseline: `636f992`.

**Status: kit 1.0.0 approved for local integration and integrated into the app (24 November 2026).** The owner selected **A / Side by Side** with the message “a” on 23 November 2026, then handed over the [integration prompt](integration-prompt.md) for execution on 24 November 2026; the manifest records both separately. The [delivered kit](../../brand/README.md), [visual gallery](../../brand/index.html), [preview](../../brand/exports/preview.png), [guidelines PDF](../../brand/exports/FocusKept-guidelines.pdf), and [usage rules](usage.md) are available. The application now uses the kit (logo, icons, manifest, OG/share images, email); see [verification.md](verification.md) for what was checked and what is still outstanding, and [DESIGN.md](../DESIGN.md) plus decisions D19/D20 in [DECISIONS.md](../../DECISIONS.md) for the UI rules. Nothing was published, deployed, or uploaded to external accounts.

This directory is the starting point for people and agents working on the brand. Repository documentation is in English so public contributors can use it.

| Document                                       | Purpose                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [research.md](research.md)                     | Product, audience, repository audit, observed inconsistencies, and competitor positioning      |
| [creative-brief.md](creative-brief.md)         | Positioning, three identity directions, recommended route, voice, and review criteria          |
| [asset-spec.md](asset-spec.md)                 | Required deliverables, dimensions, formats, variants, future file layout, and release contract |
| [integration-prompt.md](integration-prompt.md) | Complete implementation handoff for an agent once an approved kit exists                       |
| [sources-and-tools.md](sources-and-tools.md)   | Primary research sources, evaluated skills, and actual installation status                     |
| [usage.md](usage.md)                           | Delivered Side by Side logo, color, type, icon, social, and email rules                        |
| [verification.md](verification.md)             | Integration checks, inspected views, measured pairs, limits, and outstanding external uploads  |

## Sequence

1. Compare three concept boards in the same real contexts: header, 16/32 px favicon, app tile, email header, and social card.
2. Select a direction and refine its mark, wordmark, palette, and typography together. The recommendation in the brief is a proposal, not recorded approval.
3. Produce the vector masters, exports, tokens, font notices, usage rules, and a complete verified asset manifest described in the specification.
4. Record the approved direction and version in the future `brand/manifest.json`, then use the integration prompt.
5. Verify runtime rebranding, accessibility, email, metadata, Docker packaging, and all existing checks affected by the changes.

## Authority

`brand/` now owns the delivered creative sources and verified export manifest; `src/config/` remains the application configuration boundary. The manifest records the kit's actual review/integration state. Generated files must be traceable to those sources. Neither an agent's recommendation nor a generated image is evidence of owner approval.

Keep ordinary application dependencies unchanged during research. Keep external design skills outside the public app repository; record their provenance here rather than copying unrelated tool trees into the project. The handoff must also work for an agent that has none of those skills installed.
