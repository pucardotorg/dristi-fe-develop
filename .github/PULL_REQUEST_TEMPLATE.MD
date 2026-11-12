## Issue

Closes #PLEASE_TYPE_ISSUE_NUMBER

## Summary

Explain the **motivation** for making this change. What existing problem does the pull request solve?

## Screenshots

For UI changes, add before/after screenshots or a short recording, including a phone-width view.

## Checklist

Before submitting a pull request, please make sure you've completed these tasks.

- [ ] Tested the change in the running app (`npm run dev:sandbox` for design work, `npm run dev` against the backend).
- [ ] `npm run lint`, `npm run typecheck` and `npm run test:app` pass.

## Contract changes

Data contracts (`lib/<feature>/data/repository.ts`, `lib/<feature>/types.ts`) only grow. Write "None" if this PR doesn't touch them. Otherwise list:

- **Added:** new methods and fields, so engineering can implement or map them in `http.ts`.
- **Breaking:** any method or field renamed, removed, retyped or made required. Tag engineering.

## Notes

Please add here if any other information is required for the reviewer.
