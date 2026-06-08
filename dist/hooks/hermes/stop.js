#!/usr/bin/env node
import { runStopHookCli } from "../core/run-stop-hook.js";
import { evaluateHermesStopHook } from "./stop-evaluator.js";
runStopHookCli(evaluateHermesStopHook);
