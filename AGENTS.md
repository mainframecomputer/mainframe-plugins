# Agent notes

This repository packages the Mainframe Cursor, Codex, Claude Code, and Hermes plugins. Keep it
focused on the Cursor, Codex, Claude Code, and Hermes manifests, hosted MCP wiring, the
`share-video` skill, and the stop hooks.

## Repository boundaries

- User-visible copy should say "Mainframe", not legacy product names.
- Do not add secrets, customer data, private URLs, or private business context.
- Cursor, Codex, Claude Code, and Hermes are the supported hosts. Cursor, Codex, and Claude Code
  share the repo root, the `share-video` skill, the `./.mcp.json` wiring, and the `hooks/core`
  stop-hook runtime. Codex and Claude Code share the same Stop hook contract, so they both use
  `hooks/core/stop-hook.ts`; only the transcript parser differs per host. Hermes is config-driven
  and ships only the `share-video` skill plus the MCP server, generated as a
  `.hermes-plugin/config.yaml` fragment users merge into `~/.hermes/config.yaml`. Hermes ships no
  stop hook: no Hermes stop event's return value can re-engage the agent (`post_llm_call`,
  `on_session_end`, and friends are observers; shell hooks — the `hooks/core` analog — only act on
  `pre_tool_call` and a turn-start `pre_llm_call`), so there is nothing for the `hooks/core` runtime
  to drive. Do not add other host surfaces unless the product task explicitly asks for them.
- Run `bun run verify` before considering changes ready.
- Generated Cursor, Codex, Claude Code, and Hermes manifest, marketplace, and config files come
  from `tooling/generate.ts`; edit the config there, then run `bun run generate`.
- The canonical skill is `skills/share-video/SKILL.md`.
- Keep generated metadata in `.cursor-plugin/`, `.codex-plugin/`, `.agents/plugins/`,
  `.claude-plugin/`, and `.hermes-plugin/`. Do not add package-local docs or extra top-level
  markdown unless the user asks; improve `README.md` or this file instead.

## Start here

- Read before write. Grep the current implementation before editing. Source
  beats docs; if they disagree, trust source and update the doc you touched.
- Define the scope boundary. Keep one concern per change and avoid mixing
  feature work, refactors, and infrastructure unless asked.
- Implement the smallest patch that solves the real problem. Keep the program
  working at each step, and do not revert or rewrite user or coworker changes
  that are not yours.
- Sentence case for copy, docs, headings, and PR titles. Proper nouns stay
  capitalized.
- Prefer the repo's existing scripts and patterns over inventing new local
  workflows.

## Engineering principles

- KISS. Prefer explicit control flow over meta-programming or hidden dynamic
  behavior.
- YAGNI. Do not add configuration, flags, modes, or command-line arguments
  without a concrete caller.
- DRY where it matters. Remove meaningful duplication; do not contort code to
  avoid harmless repetition.
- Fail fast on unsupported or unsafe states. Keep error paths obvious and
  localized.
- Avoid vague fallbacks, broad optionality, and default arguments that hide
  required inputs. Optionality is a maintenance cost.
- Reproduce bugs before editing unless the root cause and fix are already
  proven. Use the same path to verify the fix.
- Parallelize independent work and avoid avoidable serial waits.

## Types and data

- Use Zod at boundaries. Define the schema first and infer the TypeScript type
  from it unless an existing contract owns the shape.
- Avoid `any`, broad `as` casts, and non-null assertions. Narrow, parse, or fix
  the upstream type.
- Use discriminated unions for state with meaningful variants.
- Keep braces on every `if`, `else`, `for`, and `while` body. Use top-level
  imports only.
- Dependencies live where they are used. Keep tests colocated with the behavior
  they prove.
- Comment only on high-level intent that is not obvious from the code.

## Time and defaults

- TypeScript durations are milliseconds and named accordingly, such as
  `thresholdMs` or `INACTIVITY_TIMEOUT_MS`.
- Define each default value once as a named constant. Do not restate literal
  values in comments; reference the constant name.
- Hook suggestion copy may include elapsed hours only. It must never include
  transcript content, prompts, file paths, command output, or secret-like data.

## Security

- Keep secret values server-side or out of the repo entirely. Never log raw
  tokens, private keys, cookies, OAuth codes, or full secret values.
- Fail closed on ambiguous host input, hook state, auth state, or installation
  state.
- Errors and hook reasons should help debugging without revealing private
  context or cross-tenant existence.
- Use proven libraries for security-adjacent parsing and validation. Prefer a
  schema or SDK contract over ad hoc string handling.

## Testing

- Prove the behavior you changed. Use the smallest test tier that actually
  catches the regression.
- Unit tests should be essential and test what they say they test. Avoid
  tautology assertions and duplicated implementation details.
- Generated files must stay reproducible through `bun run generate`; the local
  verification path checks generated drift without requiring a clean worktree.
- When handing work back, say what you tested and what you did not.
