// Collects borrowed Tumin memory for Float prompt assembly.
// Keep all Tumin-specific formatting and transport calls outside chat-engine.ts.

import { loadMemoryConfig } from "../memory-storage";
import {
    readBoundTuminLongTermMemory,
    readBoundTuminRecentMemory,
    type TuminBridgeLongTermItem,
    type TuminBridgeRecentItem,
} from "./transport";
import { loadTuminMemoryBridgeConfig } from "./config";

export type TuminExternalPromptContext = {
    recentText: string;
    longTermText: string;
    combinedText: string;
    recentItems: TuminBridgeRecentItem[];
    longTermItems: TuminBridgeLongTermItem[];
};

function clampTextToApproxTokenBudget(text: string, tokenBudget: number): string {
    if (!text || tokenBudget <= 0) return "";
    // Float currently uses generous token budgets. For the bridge boundary we only
    // need a deterministic safety cap; ~4 chars/token is intentionally conservative.
    const maxChars = Math.max(0, Math.floor(tokenBudget * 4));
    if (text.length <= maxChars) return text;
    return text.slice(text.length - maxChars);
}

function formatRecent(items: TuminBridgeRecentItem[]): string {
    if (items.length === 0) return "";
    return items
        .map(item => {
            const role = item.role === "user" ? "用户" : item.role === "assistant" ? "角色" : "记录";
            return `- [${role}] ${item.content.trim()}`;
        })
        .filter(line => line.length > 4)
        .join("\n");
}

function formatLongTerm(items: TuminBridgeLongTermItem[]): string {
    if (items.length === 0) return "";
    return items
        .map(item => `- ${item.content.trim()}`)
        .filter(line => line.length > 2)
        .join("\n");
}

/**
 * Read Tumin memory for one already-bound Float character.
 *
 * This function is intentionally safe-to-fail: unavailable host bridge, missing
 * binding, or disabled permissions simply produce an empty context and must never
 * block normal Float chat.
 */
export async function collectTuminExternalPromptContext(
    characterId: string,
): Promise<TuminExternalPromptContext> {
    const bridgeConfig = loadTuminMemoryBridgeConfig();
    const empty: TuminExternalPromptContext = {
        recentText: "",
        longTermText: "",
        combinedText: "",
        recentItems: [],
        longTermItems: [],
    };

    if (!bridgeConfig.enabled || !characterId.trim()) return empty;

    const [recentResult, longTermResult] = await Promise.all([
        bridgeConfig.allowFloatReadTuminRecent
            ? readBoundTuminRecentMemory(characterId).catch(() => null)
            : Promise.resolve(null),
        bridgeConfig.allowFloatReadTuminLongTerm
            ? readBoundTuminLongTermMemory(characterId).catch(() => null)
            : Promise.resolve(null),
    ]);

    const recentItems = recentResult?.success ? recentResult.items : [];
    const longTermItems = longTermResult?.success ? longTermResult.items : [];
    const memoryConfig = loadMemoryConfig();

    const recentText = clampTextToApproxTokenBudget(
        formatRecent(recentItems),
        memoryConfig.shortTermTokenBudget,
    );
    const longTermText = clampTextToApproxTokenBudget(
        formatLongTerm(longTermItems),
        memoryConfig.longTermTokenBudget,
    );

    const sections: string[] = [];
    if (recentText) {
        sections.push([
            "## 来自兔眠的近期生活上下文",
            "以下内容是同一角色在兔眠中的近期经历，仅作为自然连续性的背景。不要提及跨应用、记忆系统、同步或读取机制。",
            recentText,
        ].join("\n"));
    }
    if (longTermText) {
        sections.push([
            "## 来自兔眠的长期记忆",
            "以下内容是用户明确允许共享的长期记忆。与当前对话冲突时，以当前对话中的最新明确事实为准。",
            longTermText,
        ].join("\n"));
    }

    return {
        recentText,
        longTermText,
        combinedText: sections.join("\n\n"),
        recentItems,
        longTermItems,
    };
}
