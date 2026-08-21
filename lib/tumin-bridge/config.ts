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
registerKvMigration(CONFIG_KEY);

export function loadTuminMemoryBridgeConfig(): TuminMemoryBridgeConfig {
    if (typeof window === "undefined") return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
    try {
        const raw = kvGet(CONFIG_KEY);
        if (!raw) return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
        return {
            ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG,
            ...(JSON.parse(raw) as Partial<TuminMemoryBridgeConfig>),
        };
    } catch {
        return { ...DEFAULT_TUMIN_MEMORY_BRIDGE_CONFIG };
    }
}

export function saveTuminMemoryBridgeConfig(config: TuminMemoryBridgeConfig): void {
    if (typeof window === "undefined") return;
    kvSet(CONFIG_KEY, JSON.stringify(config));
}
