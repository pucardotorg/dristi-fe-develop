## Issue

Closes #PLEASE_TYPE_ISSUE_NUMBER

## Summary

Explain the **motivation** for making this change. What existing problem does the pull request solve?

## Screenshots

For UI changes, add before/after screenshots or a short recording, including a phone-width view.

## Checklist

Before submitting a pull request, please make sure you've completed these tasks.

- [ ] Ran `npm run dev` in the repository root and tested the change at http://localhost:3000 for each role it affects.
- [ ] `npm run verify:ui` passes (DS pin, ESLint, DS gates, agent rails).
- [ ] `npm run test:app` passes, and I've added tests for any bug fix or new logic.
- [ ] Synced DS primitives in `components/ui/` are unedited; any new or updated ones came from `npm run sync:ui`.
- [ ] Checked the layout at phone, tablet and desktop widths, plus keyboard navigation.
- [ ] If I changed `.agents/`, I ran `npm run sync:rails` and `npm run verify:agents`.

## Notes

Please add here if any other information is required for the reviewer.
