"use client";

import { useState } from "react";
import { Archive, Clock, Link2, Sparkles } from "lucide-react";
import { Toggle } from "@/components/ui/form";
import { loadMemoryConfig, saveMemoryConfig } from "@/lib/memory-storage";
import type { MemoryConfig, TuminMemoryBridgeConfig } from "@/lib/memory-types";
import { BINDING_ACCENTS } from "@/lib/ui-accent-colors";

const RECENT_CONTEXT_PRESETS = [5, 10, 20, 50] as const;

export function TuminMemoryBridgeSettings() {
    const [config, setConfig] = useState<MemoryConfig>(loadMemoryConfig);
    const bridge = config.tuminBridge;
    const isPresetLimit = RECENT_CONTEXT_PRESETS.includes(
        bridge.sharedRecentContextLimit as (typeof RECENT_CONTEXT_PRESETS)[number],
    );

    const saveBridge = (patch: Partial<TuminMemoryBridgeConfig>) => {
        const next: MemoryConfig = {
            ...config,
            tuminBridge: {
                ...config.tuminBridge,
                ...patch,
            },
        };
        setConfig(next);
        saveMemoryConfig(next);
    };

    const saveRecentLimit = (value: number) => {
        if (!Number.isFinite(value)) return;
        saveBridge({ sharedRecentContextLimit: Math.min(200, Math.max(1, Math.round(value))) });
    };

    return (
        <div className="page-menu memory-settings-menu">
            <p className="menu-group-desc mx-2">记忆互通</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.memory } as React.CSSProperties}>
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
            </div>

            <p className="menu-group-desc mx-2">短期上下文</p>
            <div className="menu-group">
                <div className="menu-item">
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.voice } as React.CSSProperties}>
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
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.voice } as React.CSSProperties}>
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
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.memory } as React.CSSProperties}>
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
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.memory } as React.CSSProperties}>
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
                    <span className="card-icon" style={{ "--icon-color": BINDING_ACCENTS.embedding } as React.CSSProperties}>
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
