# Dristi App

Main product app for Dristi. Shared UI primitives live in `src/components/ui/` and
the theme tokens in `src/app/globals.css`.

## Run

From the repository root:

```bash
git clone <this-repo> && cd <this-repo>
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Localization

UI text comes from the message catalogs in `messages/` (`en.json`, `hi.json`) through
[next-intl](https://next-intl.dev); the chosen language is kept in the `NEXT_LOCALE`
cookie. Before adding or changing any text a user sees, read
[docs/localization.md](../../docs/localization.md).
