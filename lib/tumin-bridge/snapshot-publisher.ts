// Reverse-direction bridge cache: Float publishes normalized memory snapshots through
// Tumin's existing plugin KV API. Tumin can borrow these snapshots without importing
// them into its own native memory database.

import { buildFloatMemoryBridgeSnapshot } from "./adapter";
import { getBoundTuminAssistantId, loadTuminMemoryBridgeConfig } from "./config";
import { isTuminPluginDataTransportAvailable, writeTuminPluginData } from "./transport";

const MANIFEST_KEY = "__float_memory_bridge_manifest_v1";
const SNAPSHOT_KEY_PREFIX = "__float_memory_bridge_snapshot_v1:";

export type PublishedFloatMemorySnapshot = {
    version: 1;
    updatedAt: string;
    floatCharacterId: string;
    tuminAssistantId: string;
    recent: Awaited<ReturnType<typeof buildFloatMemoryBridgeSnapshot>>["recent"];
    longTerm: Awaited<ReturnType<typeof buildFloatMemoryBridgeSnapshot>>["longTerm"];
};

/**
 * Publish the currently bound Float character to Tumin's plugin-scoped bridge cache.
 * Safe-to-fail: normal Float chat must never depend on cache publication succeeding.
 */
export async function publishBoundFloatMemorySnapshot(characterId: string): Promise<boolean> {
    const config = loadTuminMemoryBridgeConfig();
    if (!config.enabled || !characterId.trim() || !isTuminPluginDataTransportAvailable()) return false;

    const assistantId = getBoundTuminAssistantId(characterId);
    if (!assistantId) return false;
    if (!config.allowTuminReadFloatRecent && !config.allowTuminReadFloatLongTerm) return false;

    try {
        const snapshot = await buildFloatMemoryBridgeSnapshot(characterId, {
            recentLimit: config.sharedRecentContextLimit,
        });
        const published: PublishedFloatMemorySnapshot = {
            version: 1,
            updatedAt: new Date().toISOString(),
            floatCharacterId: characterId,
            tuminAssistantId: assistantId,
            recent: config.allowTuminReadFloatRecent ? snapshot.recent : [],
            longTerm: config.allowTuminReadFloatLongTerm ? snapshot.longTerm : [],
        };

        const manifestWritten = await writeTuminPluginData(MANIFEST_KEY, JSON.stringify({
            type: "float-memory-bridge",
            version: 1,
            updatedAt: published.updatedAt,
        }));
        if (!manifestWritten) return false;

        return writeTuminPluginData(
            `${SNAPSHOT_KEY_PREFIX}${assistantId}`,
            JSON.stringify(published),
        );
    } catch {
        return false;
    }
}
