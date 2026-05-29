export declare const MS_PER_HOUR = 3600000;
export declare const DEFAULT_AFK_THRESHOLD_MS = 3600000;
export type AfkGateInput = {
    stopTimeMs: number;
    lastUserTimeMs: number;
    thresholdMs: number;
    workHappened: boolean;
    alreadyShared: boolean;
};
export type AfkGateResult = {
    fire: false;
} | {
    fire: true;
    reason: string;
};
export declare function evaluateAfkGate(input: AfkGateInput): AfkGateResult;
export declare function thresholdMsFromEnv(value: string | undefined): number;
