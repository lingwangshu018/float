// lib/tumin-bridge/config.ts
// Tumin interoperability settings live outside Float's native memory config so
// upstream changes to MemoryConfig do not have to know about this extension.

import { kvGet, kvSet, registerKvMigration } from "../kv-db";

export type TuminMemoryBridgeConfig = {
    enabled: boolean;
    allowFloatReadTuminRecent: boolean;
    allowTuminReadFloatRecent: boolean;
    sharedRecentContextLimit: number;
    allowFloatReadTuminLongTerm: boolean;
    allowTuminReadFloatLongTerm: boolean;
    autoSyncImportantLongTerm: boolean;
};

export const DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG: TuminMemoryBridgeConfig = {
    enabled: false,
    allowFloatReadTuminRecent: true,
    allowTuminReadFloatRecent: true,
    sharedRecentContextLimit: 20,
    allowFloatReadTuminLongTerm: true,
    allowTuminReadFloatLongTerm: true,
    autoSyncImportantLongTerm: false,
};

const CONFIG_KEY = "ai_phone_tumin_bridge_config_v1";
const LEGACY_MEMORY_CONFIG_KEY = "ai_phone_memory_config_v1";
registerKvMigration(CONFIG_KEY);

function normalizeConfig(value?: Partial<TuminMemoryBridgeConfig> | null): TuminMemoryBridgeConfig {
    return {
        ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG,
        ...(value ?? {}),
    };
}

export function loadTuminMemoryBridgeConfig(): TuminMemoryBridgeConfig {
    if (typeof window === "undefined") return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
    try {
        const raw = kvGet(CONFIG_KEY);
        if (raw) return normalizeConfig(JSON.parse(raw) as Partial<TuminMemoryBridgeConfig>);

        // One-time compatibility for the initial bridge prototype, where these settings
        // temporarily lived inside Float's native MemoryConfig. Read-only migration keeps
        // upstream memory code clean while preserving any settings already saved by users.
        const legacyRaw = kvGet(LEGACY_MEMORY_CONFIG_KEY);
        if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) as { tuminBridge?: Partial<TuminMemoryBridgeConfig> };
            if (legacy.tuminBridge) {
                const migrated = normalizeConfig(legacy.tuminBridge);
                kvSet(CONFIG_KEY, JSON.stringify(migrated));
                return migrated;
            }
        }

        return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
    } catch {
        return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
    }
}

export function saveTuminMemoryBridgeConfig(config: TuminMemoryBridgeConfig): void {
    if (typeof window === "undefined") return;
    kvSet(CONFIG_KEY, JSON.stringify(config));
}
