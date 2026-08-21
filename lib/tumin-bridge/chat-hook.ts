// Built-in Float prompt extension for borrowed Tumin memory.
// Uses Float's stable chat-plugin hook bus so chat-engine.ts stays untouched.

import { getChatPluginHookBus } from "../chat-plugin-hooks";
import type { PromptSystemPayload } from "../chat-plugin-types";
import { collectTuminExternalPromptContext } from "./prompt-context";
import { publishBoundFloatMemorySnapshot } from "./snapshot-publisher";

const PLUGIN_ID = "builtin.tumin-memory-bridge";
const GLOBAL_DISPOSER_KEY = "__floatTuminMemoryPromptHookDisposer";

type GlobalWithDisposer = typeof globalThis & {
    [GLOBAL_DISPOSER_KEY]?: () => void;
};

/**
 * Register once per browser runtime. Safe under React StrictMode/HMR.
 * Returns a disposer for callers that explicitly want to tear the hook down.
 */
export function registerTuminMemoryPromptHook(): () => void {
    if (typeof window === "undefined") return () => {};

    const globalState = globalThis as GlobalWithDisposer;
    if (globalState[GLOBAL_DISPOSER_KEY]) return globalState[GLOBAL_DISPOSER_KEY]!;

    const dispose = getChatPluginHookBus().registerTransform(
        PLUGIN_ID,
        "prompt.system",
        async (rawPayload) => {
            const payload = rawPayload as PromptSystemPayload;
            if (payload.isGroup || !payload.characterId) return payload;

            // Reverse direction is cache-only and must never delay or block normal chat.
            void publishBoundFloatMemorySnapshot(payload.characterId);

            const external = await collectTuminExternalPromptContext(payload.characterId);
            if (!external.combinedText) return payload;

            return {
                ...payload,
                hint: [payload.hint.trim(), external.combinedText]
                    .filter(Boolean)
                    .join("\n\n"),
            } satisfies PromptSystemPayload;
        },
        90,
        8000,
    );

    const wrappedDispose = () => {
        dispose();
        if (globalState[GLOBAL_DISPOSER_KEY] === wrappedDispose) {
            delete globalState[GLOBAL_DISPOSER_KEY];
        }
    };
    globalState[GLOBAL_DISPOSER_KEY] = wrappedDispose;
    return wrappedDispose;
}
