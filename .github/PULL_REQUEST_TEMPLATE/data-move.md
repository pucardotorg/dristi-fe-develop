<!--
A data move: an older feature leaves browser storage for its repository
(.agents/policies/data-seam.md rule 2.0). Start it with
`npm run new:data -- <feature> --move`. This PR moves the data and nothing else;
new fields and visual changes come in a later PR, once this one merges.
-->

## Feature

Which feature moves (`lib/<feature>/`), and which PR or request needs its data next.

## What moved

- **Records:** which records now go through `lib/<feature>/data/` (a new field on a record moves that whole record).
- **Store:** how the old store now reads and writes through `getRepository()`, keeping the functions screens call.
- **Still in browser storage:** files of this feature still on the lint exception lists, and why they stay for now.

## Checklist

- [ ] No new fields, records or union values: `npm run check:data-moves` passes without the `old-store-fix` label.
- [ ] No visual changes: screens look the same once loaded.
- [ ] Screens only gained loading, load-failed, save-failed and "not connected yet" states.
- [ ] Sandbox mode behaves as before (create, edit, discard, reload).
- [ ] API mode shows "not connected yet", not browser data.
- [ ] The old store is off the lint exception list, and `npm run lint` passes.
- [ ] `npm run lint`, `npm run typecheck` and `npm run test:app` pass.

## Screenshots

Each changed screen loading, failing to load, and failing to save, at phone width. Loaded screens should look as before.

## Contract changes

- **Added:** the new contract (`lib/<feature>/data/repository.ts`), for engineering to implement in `http.ts`.
- **Breaking:** none expected. List any here and tag engineering.
