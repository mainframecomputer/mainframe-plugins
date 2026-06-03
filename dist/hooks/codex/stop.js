#!/usr/bin/env node
import { runStopHookCli } from "../core/run-stop-hook.js";
import { evaluateCodexStopHook } from "./stop-evaluator.js";
runStopHookCli(evaluateCodexStopHook);
