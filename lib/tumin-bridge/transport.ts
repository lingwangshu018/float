// Transport boundary for Float <-> Tumin memory interoperability.
// This file knows about the host bridge, but not about Float's chat or memory internals.

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

export type TuminBridgeReadResult<T> = {
    success: boolean;
    kind: "recent" | "long_term";
    assistantId?: string;
    items: T[];
    error?: string;
};

type TuminHostBridge = {
    memoryGetRecent?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeRecentItem>>;
    memoryGetLongTerm?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>>;
};

function getHostBridge(): TuminHostBridge | null {
    if (typeof window === "undefined") return null;
    return ((window as Window & { Bridge?: TuminHostBridge }).Bridge ?? null);
}

export function isTuminMemoryTransportAvailable(): boolean {
    const bridge = getHostBridge();
    return Boolean(bridge?.memoryGetRecent || bridge?.memoryGetLongTerm);
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
