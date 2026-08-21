// Transport boundary for Float <-> Tumin memory interoperability.
// This file knows about the host bridge, but not about Float's chat or memory internals.

import { getBoundTuminAssistantId, loadTuminMemoryBridgeConfig } from "./config";

export type TuminBridgeRecentItem = {
    id: string;
    origin: "tumin";
    kind: "recent";
    assistantId: string;
    conversationId?: string;
    messageId?: string;
    role?: string;
    content: string;
    timestamp?: number;
};

export type TuminBridgeLongTermItem = {
    id: string;
    origin: "tumin";
    kind: "long_term";
    assistantId: string;
    content: string;
};

export type TuminAssistantInfo = {
    id: string;
    name: string;
};

export type TuminBridgeReadResult<T> = {
    success: boolean;
    kind: "recent" | "long_term";
    assistantId?: string;
    items: T[];
    error?: string;
};

export type TuminAssistantListResult = {
    success: boolean;
    assistants: TuminAssistantInfo[];
    error?: string;
};

type TuminHostBridge = {
    memoryGetRecent?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeRecentItem>>;
    memoryGetLongTerm?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>>;
    memoryListAssistants?: () => Promise<TuminAssistantListResult>;
};

function getHostBridge(): TuminHostBridge | null {
    if (typeof window === "undefined") return null;
    return ((window as Window & { Bridge?: TuminHostBridge }).Bridge ?? null);
}

export function isTuminMemoryTransportAvailable(): boolean {
    const bridge = getHostBridge();
    return Boolean(bridge?.memoryGetRecent || bridge?.memoryGetLongTerm || bridge?.memoryListAssistants);
}

export async function listTuminAssistants(): Promise<TuminAssistantListResult> {
    const bridge = getHostBridge();
    if (!bridge?.memoryListAssistants) {
        return {
            success: false,
            assistants: [],
            error: "Tumin assistant-list bridge is unavailable in this host",
        };
    }
    return bridge.memoryListAssistants();
}

export async function readTuminRecentMemory(
    assistantId: string,
    limit = 20,
): Promise<TuminBridgeReadResult<TuminBridgeRecentItem>> {
    const bridge = getHostBridge();
    if (!bridge?.memoryGetRecent) {
        return {
            success: false,
            kind: "recent",
            assistantId,
            items: [],
            error: "Tumin memory bridge is unavailable in this host",
        };
    }
    return bridge.memoryGetRecent(assistantId, limit);
}

export async function readTuminLongTermMemory(
    assistantId: string,
    limit = 200,
): Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>> {
    const bridge = getHostBridge();
    if (!bridge?.memoryGetLongTerm) {
        return {
            success: false,
            kind: "long_term",
            assistantId,
            items: [],
            error: "Tumin memory bridge is unavailable in this host",
        };
    }
    return bridge.memoryGetLongTerm(assistantId, limit);
}

export async function readBoundTuminRecentMemory(
    characterId: string,
): Promise<TuminBridgeReadResult<TuminBridgeRecentItem>> {
    const config = loadTuminMemoryBridgeConfig();
    const assistantId = getBoundTuminAssistantId(characterId);
    if (!config.enabled || !config.allowFloatReadTuminRecent) {
        return { success: false, kind: "recent", assistantId: assistantId ?? undefined, items: [], error: "Tumin recent-memory reading is disabled" };
    }
    if (!assistantId) {
        return { success: false, kind: "recent", items: [], error: "No Tumin assistant is bound to this Float character" };
    }
    return readTuminRecentMemory(assistantId, config.sharedRecentContextLimit);
}

export async function readBoundTuminLongTermMemory(
    characterId: string,
    limit = 200,
): Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>> {
    const config = loadTuminMemoryBridgeConfig();
    const assistantId = getBoundTuminAssistantId(characterId);
    if (!config.enabled || !config.allowFloatReadTuminLongTerm) {
        return { success: false, kind: "long_term", assistantId: assistantId ?? undefined, items: [], error: "Tumin long-term-memory reading is disabled" };
    }
    if (!assistantId) {
        return { success: false, kind: "long_term", items: [], error: "No Tumin assistant is bound to this Float character" };
    }
    return readTuminLongTermMemory(assistantId, limit);
}
