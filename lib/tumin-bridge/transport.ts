// Transport boundary for Float <-> Tumin memory interoperability.
// Prefer optional dedicated methods when present, otherwise use Tumin's existing plugin KV bridge.

import { getBoundTuminAssistantId, loadTuminMemoryBridgeConfig } from "./config";

const TUMIN_SNAPSHOT_PREFIX = "__tumin_memory_bridge_snapshot_v1:";
const TUMIN_ASSISTANTS_KEY = "__tumin_memory_bridge_assistants_v1";

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

export type TuminAssistantInfo = { id: string; name: string };
export type TuminBridgeReadResult<T> = {
    success: boolean;
    kind: "recent" | "long_term";
    assistantId?: string;
    items: T[];
    error?: string;
};
export type TuminAssistantListResult = { success: boolean; assistants: TuminAssistantInfo[]; error?: string };

type TuminHostBridge = {
    memoryGetRecent?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeRecentItem>>;
    memoryGetLongTerm?: (assistantId: string, limit?: number) => Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>>;
    memoryListAssistants?: () => Promise<TuminAssistantListResult>;
    setData?: (key: string, value: string) => Promise<unknown>;
    getData?: (key: string) => Promise<string | null>;
};

type TuminFloatPortalBridge = {
    setData?: (key: string, value: string) => boolean;
    getData?: (key: string) => string | null;
};

function getHostBridge(): TuminHostBridge | null {
    if (typeof window === "undefined") return null;

    const hostWindow = window as Window & {
        Bridge?: TuminHostBridge;
        TuminFloatBridge?: TuminFloatPortalBridge;
    };
    if (hostWindow.Bridge) return hostWindow.Bridge;

    const portal = hostWindow.TuminFloatBridge;
    if (!portal) return null;

    return {
        getData: portal.getData
            ? async (key: string) => portal.getData!(key)
            : undefined,
        setData: portal.setData
            ? async (key: string, value: string) => portal.setData!(key, value)
            : undefined,
    };
}

export function isTuminMemoryTransportAvailable(): boolean {
    const bridge = getHostBridge();
    return Boolean(bridge?.getData || bridge?.memoryGetRecent || bridge?.memoryGetLongTerm || bridge?.memoryListAssistants);
}

export function isTuminPluginDataTransportAvailable(): boolean {
    return Boolean(getHostBridge()?.setData);
}

export async function writeTuminPluginData(key: string, value: string): Promise<boolean> {
    const bridge = getHostBridge();
    if (!bridge?.setData) return false;
    try { await bridge.setData(key, value); return true; } catch { return false; }
}

async function readKvJson(key: string): Promise<Record<string, unknown> | null> {
    const bridge = getHostBridge();
    if (!bridge?.getData) return null;
    try {
        const raw = await bridge.getData(key);
        if (!raw) return null;
        return JSON.parse(raw) as Record<string, unknown>;
    } catch { return null; }
}

export async function listTuminAssistants(): Promise<TuminAssistantListResult> {
    const bridge = getHostBridge();
    if (bridge?.memoryListAssistants) return bridge.memoryListAssistants();
    const cached = await readKvJson(TUMIN_ASSISTANTS_KEY);
    const assistants = Array.isArray(cached?.assistants) ? cached.assistants.filter((item): item is TuminAssistantInfo => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;
        return typeof value.id === "string" && typeof value.name === "string";
    }) : [];
    return assistants.length
        ? { success: true, assistants }
        : { success: false, assistants: [], error: "Tumin assistant catalog is not available yet" };
}

export async function readTuminRecentMemory(assistantId: string, limit = 20): Promise<TuminBridgeReadResult<TuminBridgeRecentItem>> {
    const bridge = getHostBridge();
    if (bridge?.memoryGetRecent) return bridge.memoryGetRecent(assistantId, limit);
    const cached = await readKvJson(TUMIN_SNAPSHOT_PREFIX + assistantId);
    const items = Array.isArray(cached?.recent) ? (cached.recent as TuminBridgeRecentItem[]).slice(-Math.max(1, limit)) : [];
    return cached
        ? { success: true, kind: "recent", assistantId, items }
        : { success: false, kind: "recent", assistantId, items: [], error: "Tumin memory snapshot is not available yet" };
}

export async function readTuminLongTermMemory(assistantId: string, limit = 200): Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>> {
    const bridge = getHostBridge();
    if (bridge?.memoryGetLongTerm) return bridge.memoryGetLongTerm(assistantId, limit);
    const cached = await readKvJson(TUMIN_SNAPSHOT_PREFIX + assistantId);
    const items = Array.isArray(cached?.longTerm) ? (cached.longTerm as TuminBridgeLongTermItem[]).slice(-Math.max(1, limit)) : [];
    return cached
        ? { success: true, kind: "long_term", assistantId, items }
        : { success: false, kind: "long_term", assistantId, items: [], error: "Tumin memory snapshot is not available yet" };
}

export async function readBoundTuminRecentMemory(characterId: string): Promise<TuminBridgeReadResult<TuminBridgeRecentItem>> {
    const config = loadTuminMemoryBridgeConfig();
    const assistantId = getBoundTuminAssistantId(characterId);
    if (!config.enabled || !config.allowFloatReadTuminRecent) return { success: false, kind: "recent", assistantId: assistantId ?? undefined, items: [], error: "Tumin recent-memory reading is disabled" };
    if (!assistantId) return { success: false, kind: "recent", items: [], error: "No Tumin assistant is bound to this Float character" };
    return readTuminRecentMemory(assistantId, config.sharedRecentContextLimit);
}

export async function readBoundTuminLongTermMemory(characterId: string, limit = 200): Promise<TuminBridgeReadResult<TuminBridgeLongTermItem>> {
    const config = loadTuminMemoryBridgeConfig();
    const assistantId = getBoundTuminAssistantId(characterId);
    if (!config.enabled || !config.allowFloatReadTuminLongTerm) return { success: false, kind: "long_term", assistantId: assistantId ?? undefined, items: [], error: "Tumin long-term-memory reading is disabled" };
    if (!assistantId) return { success: false, kind: "long_term", items: [], error: "No Tumin assistant is bound to this Float character" };
    return readTuminLongTermMemory(assistantId, limit);
}
