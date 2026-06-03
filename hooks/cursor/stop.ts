#!/usr/bin/env node
import { runStopHookCli } from "../core/run-stop-hook.js";
import { evaluateCursorStopHook } from "./stop-evaluator.js";

runStopHookCli(evaluateCursorStopHook);
