import { readFileSync } from "node:fs";

// Shared stop-hook CLI plumbing: read the host payload from stdin, run a pure
// evaluator, and emit its JSON result. Keeps host evaluators free of I/O.
export function runStopHookCli(evaluate: (input: { stdin: string }) => object): void {
  const stdin = readFileSync(0, "utf8");
  const output = evaluate({ stdin });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
