export type StopHookEvaluationInput = {
    stdin: string;
    env?: NodeJS.ProcessEnv;
    nowMs?: number;
};
export type StopHookOutput = {
    decision: "block";
    reason: string;
    followup_message?: never;
} | {
    followup_message: string;
    decision?: never;
    reason?: never;
} | {
    decision?: never;
    reason?: never;
    followup_message?: never;
};
export declare function evaluateStopHook(input: StopHookEvaluationInput): StopHookOutput;
export declare function runStopHookCli(): void;
