"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Archive, Clock, Link2, Sparkles, Users } from "lucide-react";
import { Toggle } from "@/components/ui/form";
import { loadCharacters } from "@/lib/character-storage";
import {
    bindTuminAssistant,
    loadTuminMemoryBridgeConfig,
    saveTuminMemoryBridgeConfig,
    unbindTuminAssistant,
    type TuminMemoryBridgeConfig,
} from "@/lib/tumin-bridge/config";
import {
    isTuminMemoryTransportAvailable,
    listTuminAssistants,
    type TuminAssistantInfo,
} from "@/lib/tumin-bridge/transport";
import { BINDING_ACCENTS } from "@/lib/ui-accent-colors";

const RECENT_CONTEXT_PRESETS = [5, 10, 20, 50] as const;

function normalizeDisplayName(value: string): string {
    return value.trim().toLocaleLowerCase();
}

export function TuminMemoryBridgeSettings() {
    const [bridge, setBridge] = useState<TuminMemoryBridgeConfig>(loadTuminMemoryBridgeConfig);
    const [transportAvailable, setTransportAvailable] = useState(false);
    const [tuminAssistants, setTuminAssistants] = useState<TuminAssistantInfo[]>([]);
    const [loadingAssistants, setLoadingAssistants] = useState(false);
    const [bindingError, setBindingError] = useState("");
    const floatCharacters = loadCharacters();
    const isPresetLimit = RECENT_CONTEXT_PRESETS.includes(
        bridge.sharedRecentContextLimit as (typeof RECENT_CONTEXT_PRESETS)[number],
    );

    useEffect(() => {
        const available = isTuminMemoryTransportAvailable();
        setTransportAvailable(available);
        if (!available) return;

        let cancelled = false;
        setLoadingAssistants(true);
        void listTuminAssistants()
            .then(result => {
                if (!cancelled && result.success) setTuminAssistants(result.assistants);
            })
            .finally(() => {
                if (!cancelled) setLoadingAssistants(false);
            });
        return () => { cancelled = true; };
    }, []);

    const usedAssistantIds = useMemo(
        () => new Set(Object.values(bridge.characterBindings).filter(Boolean)),
        [bridge.characterBindings],
    );

    const saveBridge = (patch: Partial<TuminMemoryBridgeConfig>) => {
        const next = { ...bridge, ...patch };
        setBridge(next);
        saveTuminMemoryBridgeConfig(next);
    };

    const saveRecentLimit = (value: number) => {
        if (!Number.isFinite(value)) return;
        saveBridge({ sharedRecentContextLimit: Math.min(200, Math.max(1, Math.round(value))) });
    };

    const setCharacterBinding = (characterId: string, assistantId: string) => {
        setBindingError("");
        try {
            const next = assistantId
                ? bindTuminAssistant(characterId, assistantId)
                : unbindTuminAssistant(characterId);
            setBridge(next);
        } catch (error) {
            setBindingError(error instanceof Error ? error.message : "角色绑定失败");
        }
    };

    const sameNameSuggestionFor = (characterId: string, characterName: string): TuminAssistantInfo | null => {
        if (bridge.characterBindings[characterId]) return null;
        const normalized = normalizeDisplayName(characterName);
        if (!normalized) return null;
        return tuminAssistants.find(assistant => (
            normalizeDisplayName(assistant.name) === normalized
            && !usedAssistantIds.has(assistant.id)
        )) ?? null;
    };

    const iconStyle = (color: string): CSSProperties => ({ "--icon-color": color } as CSSProperties);

    return (
        <div className="page-menu memory-settings-menu">
            <p className="menu-group-desc mx-2">记忆互通</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.memory)}>
                        <Link2 size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">兔眠记忆互通</span>
                        <span className="menu-desc">允许 float 与兔眠按设置共享记忆上下文</span>
                    </div>
                    <div className="menu-right">
                        <Toggle checked={bridge.enabled} onChange={(value) => saveBridge({ enabled: value })} />
                    </div>
                </div>
                <div className="menu-item">
                    <div className="menu-label-group">
                        <span className="menu-label">连接状态</span>
                        <span className="menu-desc">
                            {transportAvailable ? "已检测到兔眠宿主记忆桥" : "尚未检测到兔眠宿主记忆桥"}
                        </span>
                    </div>
                    <div className="menu-right">
                        <span className="menu-desc">{transportAvailable ? "已连接" : "未连接"}</span>
                    </div>
                </div>
            </div>

            <p className="menu-group-desc mx-2">角色绑定</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.memory)}>
                        <Users size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">float 角色 ↔ 兔眠助手</span>
                        <span className="menu-desc">严格一对一绑定；同名只会提示，需手动确认</span>
                    </div>
                </div>
                {bindingError && (
                    <div className="menu-item">
                        <div className="menu-label-group">
                            <span className="menu-desc">{bindingError}</span>
                        </div>
                    </div>
                )}
                {floatCharacters.length === 0 ? (
                    <div className="menu-item">
                        <div className="menu-label-group">
                            <span className="menu-desc">暂无 float 角色可绑定</span>
                        </div>
                    </div>
                ) : floatCharacters.map(character => {
                    const currentAssistantId = bridge.characterBindings[character.id] ?? "";
                    const suggestion = sameNameSuggestionFor(character.id, character.name || "");
                    return (
                        <div className="menu-item" key={character.id} style={{ alignItems: "flex-start" }}>
                            <div className="menu-label-group">
                                <span className="menu-label">{character.name || "未命名角色"}</span>
                                <span className="menu-desc">{currentAssistantId ? "已绑定" : "未绑定"}</span>
                                {suggestion && (
                                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        <span className="menu-desc">发现同名兔眠助手：{suggestion.name}</span>
                                        <button
                                            type="button"
                                            className="ui-chip"
                                            onClick={() => setCharacterBinding(character.id, suggestion.id)}
                                        >
                                            确认绑定
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="menu-right" style={{ minWidth: 160 }}>
                                <select
                                    className="ui-input"
                                    value={currentAssistantId}
                                    disabled={!transportAvailable || loadingAssistants}
                                    onChange={(event) => setCharacterBinding(character.id, event.target.value)}
                                    aria-label={`${character.name || "角色"}对应的兔眠助手`}
                                    style={{ width: 160 }}
                                >
                                    <option value="">不绑定</option>
                                    {tuminAssistants.map(assistant => {
                                        const occupiedByAnother = usedAssistantIds.has(assistant.id) && assistant.id !== currentAssistantId;
                                        return (
                                            <option key={assistant.id} value={assistant.id} disabled={occupiedByAnother}>
                                                {assistant.name || assistant.id}{occupiedByAnother ? "（已绑定）" : ""}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    );
                })}
                {transportAvailable && loadingAssistants && (
                    <div className="menu-item">
                        <div className="menu-label-group">
                            <span className="menu-desc">正在读取兔眠助手列表…</span>
                        </div>
                    </div>
                )}
            </div>

            <p className="menu-group-desc mx-2">短期上下文</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.voice)}>
                        <Clock size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">允许 float 读取兔眠近期记忆</span>
                        <span className="menu-desc">聊天时可临时借用兔眠提供的近期上下文</span>
                    </div>
                    <div className="menu-right">
                        <Toggle
                            checked={bridge.allowFloatReadTuminRecent}
                            onChange={(value) => saveBridge({ allowFloatReadTuminRecent: value })}
                        />
                    </div>
                </div>
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.voice)}>
                        <Clock size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">允许兔眠读取 float 近期记忆</span>
                        <span className="menu-desc">仅按共享数量提供上下文，不写入对方短期库</span>
                    </div>
                    <div className="menu-right">
                        <Toggle
                            checked={bridge.allowTuminReadFloatRecent}
                            onChange={(value) => saveBridge({ allowTuminReadFloatRecent: value })}
                        />
                    </div>
                </div>
            </div>

            <p className="menu-group-desc mx-2">共享最近上下文</p>
            <div className="menu-group">
                <div className="menu-item" style={{ alignItems: "flex-start" }}>
                    <div className="menu-label-group" style={{ width: "100%" }}>
                        <span className="menu-label">共享最近上下文</span>
                        <span className="menu-desc">控制跨应用最多共享多少条近期上下文</span>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {RECENT_CONTEXT_PRESETS.map(limit => (
                                <button
                                    key={limit}
                                    type="button"
                                    className="ui-chip"
                                    {...(bridge.sharedRecentContextLimit === limit ? { "data-selected": "" } : {})}
                                    onClick={() => saveRecentLimit(limit)}
                                >
                                    {limit} 条
                                </button>
                            ))}
                            <button
                                type="button"
                                className="ui-chip"
                                {...(!isPresetLimit ? { "data-selected": "" } : {})}
                                onClick={() => {
                                    if (isPresetLimit) saveRecentLimit(30);
                                }}
                            >
                                自定义
                            </button>
                        </div>
                        {!isPresetLimit && (
                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    className="ui-input"
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={bridge.sharedRecentContextLimit}
                                    onChange={(event) => saveRecentLimit(Number(event.target.value))}
                                    aria-label="自定义共享最近上下文条数"
                                    style={{ width: 110 }}
                                />
                                <span className="menu-desc">条（1-200）</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="menu-group-desc mx-2">长期记忆</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.memory)}>
                        <Archive size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">允许 float 读取兔眠长期记忆</span>
                        <span className="menu-desc">允许在需要时读取兔眠共享的长期记忆</span>
                    </div>
                    <div className="menu-right">
                        <Toggle
                            checked={bridge.allowFloatReadTuminLongTerm}
                            onChange={(value) => saveBridge({ allowFloatReadTuminLongTerm: value })}
                        />
                    </div>
                </div>
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.memory)}>
                        <Archive size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">允许兔眠读取 float 长期记忆</span>
                        <span className="menu-desc">允许兔眠按需读取 float 已保存的长期记忆</span>
                    </div>
                    <div className="menu-right">
                        <Toggle
                            checked={bridge.allowTuminReadFloatLongTerm}
                            onChange={(value) => saveBridge({ allowTuminReadFloatLongTerm: value })}
                        />
                    </div>
                </div>
                <div className="menu-item">
                    <span className="card-icon" style={iconStyle(BINDING_ACCENTS.embedding)}>
                        <Sparkles size={22} strokeWidth={1.75} />
                    </span>
                    <div className="menu-label-group">
                        <span className="menu-label">自动同步重要长期记忆</span>
                        <span className="menu-desc">重要长期记忆生成后自动同步给兔眠；默认关闭</span>
                    </div>
                    <div className="menu-right">
                        <Toggle
                            checked={bridge.autoSyncImportantLongTerm}
                            onChange={(value) => saveBridge({ autoSyncImportantLongTerm: value })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
