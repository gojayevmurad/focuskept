# Message context for translators

`en.json` is the source of truth. Every locale file mirrors its keys exactly.
Tone everywhere: calm, friendly, concise, encouraging, never pushy or guilt-tripping.
Address the user informally (e.g. de `du`, fr `tu`, es `tú`). Brand and proper technique names: see `glossary.json`.

Space limits: buttons ≤ ~20 characters; tabs and mobile bottom-nav labels ≤ ~12
characters; badges ≤ ~14 characters. Prefer the shortest natural wording.

| Namespace  | Where it appears                                                        | Notes                                                                                                                               |
| ---------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `common`   | Header, menus, footer, pill nav and phone tab bar (4 tabs), toasts      | `nav.timer/tasks/cards/stats` are tab labels: ≤ 12 chars.                                                                           |
| `meta`     | `<title>` and meta descriptions (search results)                        | Titles ≤ 60 chars, descriptions ≤ 155 chars. Use local search phrasing.                                                             |
| `errors`   | 404 / error pages                                                       | Short and reassuring.                                                                                                               |
| `auth`     | Sign-in, sign-up, password reset, verify-email pages                    | `legal` contains `<terms>`/`<privacy>` tags: keep both.                                                                             |
| `email`    | Auth, review-digest and weekly-report emails                            | Subjects ≤ 60 chars. Shown in the recipient's saved language.                                                                       |
| `settings` | Settings pages                                                          | `delete.word` is the word the user must type to confirm deletion: use a natural uppercase word in the language (e.g. de `LÖSCHEN`). |
| `billing`  | Billing page, checkout buttons                                          | Plan names "Pro" stays; "Free" is translated.                                                                                       |
| `landing`  | Landing page                                                            | Hero title ≤ 50 chars. Marketing tone but honest: no invented numbers.                                                              |
| `home`     | Timer home: setup card, rhythm sheet, running card, breaks, end screens | `moods.*` are the five rating words: short, gender-neutral. `rhythmSub.*` ≤ ~32 chars.                                              |
