export type StopHookEvaluationInput = {
    stdin: string;
    nowMs?: number;
};
export type StopHookOutput = {
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
