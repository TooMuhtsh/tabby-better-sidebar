export interface AuthenticationFailure {
    partialSuccess?: boolean;
    remainingMethods: string[];
}
export interface AuthenticationPlan<T> {
    remainingMethods: T[];
    allowedMethods: string[];
}
export declare function selectNextAuthMethod<T>(remainingMethods: readonly T[], allowedMethods: readonly string[], getAuthType: (method: T) => string): T | undefined;
export declare function updateAuthPlanAfterFailure<T>(remainingMethods: readonly T[], failure: AuthenticationFailure, getAuthType: (method: T) => string, createPartialSuccessFallback: (authType: string) => T | null): AuthenticationPlan<T>;
