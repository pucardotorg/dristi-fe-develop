---
name: design-review
description: "Apply the owner's design feedback (written notes, screenshots, or a pasted design report). For explicit Pencil requests, import and compare editable artboards before applying authorized changes."
---

# Design review — read the feedback, then implement the agreed changes

This repository has no in-app annotation overlay (the old design-mode tool was removed).
Feedback arrives as written notes, screenshots, or a design report pasted from an earlier
session. If the owner asks for the overlay, say it is not here and propose bringing it
back as its own reviewed change; do not copy it in from another branch.

## Starting a review

1. **Server**: check the app responds. If not, ask the user to run
   `npm run dev` in their own terminal (never start it yourself — see
   `.agents/policies/dev-server.md`). Confirm the running server serves this checkout
   before relying on it.
2. **Locate the screen**: the route the user named, else the screen under discussion,
   else `/advocate`. Read the current render before acting on any note about it.

## Implementing the feedback

Entries in the formats below come from pasted design reports; treat plain notes the same way.

The report is owner intent, not literal CSS. Apply only changes the user authorized. Before editing, load
`pull-ui-from-ds` and `ui-craft` (mandatory), and run `npm run check:ds-fresh`.

- **Style edits** (`[font-size] 24px → 18px`, `[padding] …`): map the target
  value to the nearest DS type role / spacing-ladder step / token — never copy
  raw pixel values or hex into the code. If the mapped value differs from the
  asked one, say so when reporting.
- **`{ds:<slot>}` tags — the design-system guardrail.** An entry tagged with a
  data-slot targets a synced DS primitive. NEVER restyle the primitive locally
  or hand-edit it: either an existing variant/size already expresses the ask
  (use it), or this is an upstream design-system change — record it as a DS
  proposal (token, measured value, where it shows), put it to the owner, and
  only change the DS via its own repo + `ds:bump` flow. Local screen overrides
  of primitive internals are the defect this tag exists to stop.
- **One instance edited = the owning layer changes.** An edit on one card,
  row, or name is a request against whatever owns it — the shared component,
  the content file, or the seed data — so the change lands once at the source
  and every instance updates. Never fork a single instance to match the
  report; find the owner (component prop/class, `content.ts` copy, fixture
  data) and change it there.
- **`[text]` edits**: new copy, verbatim — but bilingual: update both `en` and
  `ml` in the content file, flagging drafted Malayalam for review.
- **`[delete]`**: the element did not earn its place — remove it from the
  composition (not `display:none`), and take dependent logic/copy with it.
- **`[duplicate]`**: the owner wants another of these in the stack — usually a
  data question (one more item, one more action), not a copy-paste of JSX.
  Read what the element renders and extend the source accordingly.
- **Auto-layout edits** (`[display] flex`, `[flex-direction]`, `[gap]`,
  `[align-items]`): restructure with the codebase's layout idioms (flex + gap
  on the ladder), not inline styles.
- **Comments**: feedback to evaluate against the active task agreement and relevant
  design reasoning. If a comment conflicts with a DS law, do what the law allows
  and flag the tension rather than silently ignoring the note.
- **Box comments** (`[box W×H at x,y] region near …`): the note is about a
  region, not one element — read the area's composition, not just the selector
  hint. **Reference images** (`dm-ref-N.jpg`) were auto-downloaded on the
  user's machine when they copied the report; if the paste mentions one that
  is not attached, ask for it before acting on that comment — it is the visual
  spec for that note.
- The selector in each entry locates the element; the quoted label confirms
  you have the right one. Selectors are brittle across edits — resolve them
  against source components, don't grep for the selector string.

After implementing: follow `.agents/policies/verification.md` for UI checks,
relevant behavior tests and live-render verification, and summarise what was applied
as-asked, what was translated (and to which token), and what was declined and
why. Offer another round.

## Pencil work

For an explicit Pencil import or review request, read the skill-relative
[Pencil workflow](references/pencil.md). Do not load it for an ordinary feedback round.
