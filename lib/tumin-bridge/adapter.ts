// lib/tumin-bridge/adapter.ts
// Float-side adapter for Tumin memory interoperability.
// Transport-agnostic: it only normalizes Float memory for a host bridge.

import { loadMemoryEntriesByType } from "../memory-storage";
import { prepareShortTermContext } from "../short-term-assembler";
import type { MemoryEntry } from "../memory-types";
import { loadTuminMemoryBridgeConfig, type TuminMemoryBridgeConfig } from "./config";

export type TuminBridgeMemoryItem = {
    id: string;
    origin: "float" | "tumin";
    characterId: string;
    kind: "recent" | "long_term";
    content: string;
    timestamp: string;
    sourceApp?: string;
};

export type FloatMemoryBridgeSnapshot = {
    enabled: boolean;
    recent: TuminBridgeMemoryItem[];
    longTerm: TuminBridgeMemoryItem[];
};

function stableHash(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeLimit(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(200, Math.max(1, Math.round(value!)));
}

export function getTuminBridgeConfig(): TuminMemoryBridgeConfig {
    return loadTuminMemoryBridgeConfig();
}

export function readFloatRecentMemoryForTumin(
    characterId: string,
    options?: { limit?: number },
): TuminBridgeMemoryItem[] {
    const bridge = loadTuminMemoryBridgeConfig();
    if (!bridge.enabled || !bridge.allowTuminReadFloatRecent || !characterId.trim()) return [];

    const context = prepareShortTermContext(characterId, "chat", {
        history: [],
        includeDirectChatEntries: true,
    });
    const limit = normalizeLimit(options?.limit, bridge.sharedRecentContextLimit);
    const events = context.unifiedRecentItems
        .filter((item): item is Extract<(typeof context.unifiedRecentItems)[number], { kind: "event" }> => item.kind === "event")
        .slice(-limit);

    return events.map(item => {
        const fingerprint = `${characterId}|${item.timestamp}|${item.sourceApp}|${item.sourceTag}|${item.text}`;
        return {
            id: `float_recent_${stableHash(fingerprint)}`,
            origin: "float" as const,
            characterId,
            kind: "recent" as const,
            content: item.text,
            timestamp: item.timestamp,
            sourceApp: item.sourceApp,
        };
    });
}

function memoryEntryToBridgeItem(entry: MemoryEntry): TuminBridgeMemoryItem {
    return {
        id: `float_long_${entry.id}`,
        origin: "float",
        characterId: entry.characterId,
        kind: "long_term",
        content: entry.content,
        timestamp: entry.updatedAt || entry.createdAt,
        sourceApp: entry.sourceApp,
    };
}

export async function readFloatLongTermMemoryForTumin(
    characterId: string,
    options?: { limit?: number },
): Promise<TuminBridgeMemoryItem[]> {
    const bridge = loadTuminMemoryBridgeConfig();
    if (!bridge.enabled || !bridge.allowTuminReadFloatLongTerm || !characterId.trim()) return [];

    const entries = await loadMemoryEntriesByType(characterId, "long_term");
    const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const limit = options?.limit === undefined ? sorted.length : normalizeLimit(options.limit, sorted.length || 1);
    return sorted.slice(0, limit).map(memoryEntryToBridgeItem);
}

export async function buildFloatMemoryBridgeSnapshot(
    characterId: string,
    options?: { recentLimit?: number; longTermLimit?: number },
): Promise<FloatMemoryBridgeSnapshot> {
    const bridge = loadTuminMemoryBridgeConfig();
    if (!bridge.enabled) return { enabled: false, recent: [], longTerm: [] };

    const longTerm = await readFloatLongTermMemoryForTumin(characterId, {
        limit: options?.longTermLimit,
    });

    return {
        enabled: true,
        recent: readFloatRecentMemoryForTumin(characterId, { limit: options?.recentLimit }),
        longTerm,
    };
}
