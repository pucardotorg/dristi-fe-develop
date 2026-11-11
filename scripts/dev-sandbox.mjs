#!/usr/bin/env node
/**
 * dev-sandbox — run the app with every feature on the in-browser sandbox: demo data and
 * demo sign-in (any 6-digit code), no backend needed. For design work and demos.
 *
 *   npm run dev:sandbox            (extra arguments go to `next dev`, e.g. -- -p 3001)
 *
 * Both settings are set here, in the process environment, because that wins over
 * apps/dristi-app/.env.development, whose team default is real sign-in. A script rather
 * than `VAR=x npm run dev` so it also works in Windows shells.
 */
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_PUBLIC_DATA_SOURCE: "sandbox",
  NEXT_PUBLIC_AUTH_SOURCE: "sandbox",
};
const args = ["run", "dev", "-w", "@pucar/dristi-app", "--", ...process.argv.slice(2)];
// npm_execpath (set when run through npm) avoids shell interpolation and npm.cmd issues.
const npmPath = process.env.npm_execpath;
const child = npmPath
  ? spawn(process.execPath, [npmPath, ...args], { env, stdio: "inherit" })
  : spawn("npm", args, { env, stdio: "inherit", shell: process.platform === "win32" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
