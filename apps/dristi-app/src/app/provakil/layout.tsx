import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/provakil/provakil.css";

/**
 * Demo only: a stand-in for Tata Capital's Provakil workspace, served from this app at
 * `/provakil` so one deployment holds both sides of the bulk filing demo. It is another
 * product, so it carries its own look and none of DRISTI's; it reaches SARAS 2.0 only
 * through the court's Bulk Filing API (`provakil/lib/saras-link.ts`).
 */

/* From the app's own file, not Google Fonts: nothing is fetched from a public CDN, at
   build time or in the browser (issue #44). It is the same latin variable Roboto Google
   served, declared at the three weights Provakil asked Google for, so nothing renders
   differently. next/font takes literals only, hence the repeated path. */
const roboto = localFont({
  src: [
    { path: "../../provakil/fonts/roboto-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "../../provakil/fonts/roboto-latin-variable.woff2", weight: "500", style: "normal" },
    { path: "../../provakil/fonts/roboto-latin-variable.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: { default: "Provakil", template: "%s | Provakil" },
  description: "Demo stand-in for a Provakil Legal Collections workspace.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // `data-court-raw`: Provakil's words are its own, not the court's to re-voice.
  return (
    <div data-court-raw className={`provakil ${roboto.variable}`}>
      {children}
    </div>
  );
}
