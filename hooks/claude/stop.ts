#!/usr/bin/env node
import { runStopHookCli } from "../core/run-stop-hook.js";
import { evaluateClaudeStopHook } from "./stop-evaluator.js";

runStopHookCli(evaluateClaudeStopHook);
