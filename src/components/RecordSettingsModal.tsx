import { X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { t } from "../utils/i18n";

export interface RecordSettings {
  systemAudioDevice: string;
  systemVolume: number;
  micDevice: string;
  micVolume: number;
  outputFormat: string;
  bitrate: string;
  autoSaveEnabled: boolean;
  autoSaveByTime: boolean;
  autoSaveTime: string;
  autoSaveBySize: boolean;
  autoSaveSize: string;
  hotkeys: {
    startStop: string;
    pause: string;
  };
}

interface RecordSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RecordSettings;
  onSave: (settings: RecordSettings) => void;
}

type TabType = "volume" | "output" | "autoSave";

export default function RecordSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: RecordSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("volume");
  const [localSettings, setLocalSettings] = useState<RecordSettings>(settings);
  
  const volumeRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const autoSaveRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 滚动监听，更新左侧标签页选中状态
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    
    const containerTop = contentRef.current.getBoundingClientRect().top;
    
    // 检查每个区域的位置
    const sections = [
      { id: "volume" as TabType, ref: volumeRef },
      { id: "output" as TabType, ref: outputRef },
      { id: "autoSave" as TabType, ref: autoSaveRef },
    ];
    
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section.ref.current) {
        const rect = section.ref.current.getBoundingClientRect();
        const relativeTop = rect.top - containerTop;
        if (relativeTop <= 50) {
          setActiveTab(section.id);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (container && isOpen) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, isOpen]);

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; ref: React.RefObject<HTMLDivElement | null> }[] = [
    { id: "volume", label: t("record.volume_effects"), ref: volumeRef },
    { id: "output", label: t("record.output_settings"), ref: outputRef },
    { id: "autoSave", label: t("record.auto_save"), ref: autoSaveRef },
  ];

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    const targetRef = tabs.find(t => t.id === tab)?.ref;
    if (targetRef?.current && contentRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleResetDefaults = () => {
    setLocalSettings({
      systemAudioDevice: t("record.device_default"),
      systemVolume: 100,
      micDevice: t("record.device_default"),
      micVolume: 100,
      outputFormat: "MP3",
      bitrate: t("record.bitrate_128"),
      autoSaveEnabled: false,
      autoSaveByTime: false,
      autoSaveTime: "00:00:10.000",
      autoSaveBySize: false,
      autoSaveSize: "1.00",
      hotkeys: {
        startStop: "Ctrl+R",
        pause: "Ctrl+P",
      },
    });
  };

  const handleConfirm = () => {
    onSave(localSettings);
    onClose();
  };

  const openSystemSettings = () => {
    alert(t("record.open_system_settings_tip") || "此功能需要系统权限，请手动打开系统声音设置");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e2a3a] rounded-lg w-[700px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a4a5a]">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-400 rounded-sm"></div>
            </div>
            <span className="text-white text-sm font-medium">{t("record.advanced_settings")}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[500px]">
          {/* Left Tabs */}
          <div className="w-32 bg-[#1a2535] border-r border-[#3a4a5a] py-2 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? "text-white bg-[#2a3a4a]"
                    : "text-gray-400 hover:text-white hover:bg-[#252f3f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Content - Scrollable */}
          <div ref={contentRef} className="flex-1 p-6 overflow-y-auto">
            {/* 音量及音效 */}
            <div ref={volumeRef} className="space-y-6 pb-8">
              <h3 className="text-white text-lg font-medium">{t("record.volume_effects")}</h3>
              
              {/* 系统声音 */}
              <div className="space-y-3">
                <label className="text-gray-300 text-sm">{t("record.system_sound")}</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      value={localSettings.systemAudioDevice}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, systemAudioDevice: e.target.value })
                      }
                      className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-blue-500"
                    >
                      <option value={t("record.device_default")}>{t("record.device_default")}</option>
                      <option value={t("record.speaker")}>{t("record.speaker")}</option>
                      <option value={t("record.headphone")}>{t("record.headphone")}</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={openSystemSettings}
                    className="px-4 py-2.5 bg-[#2a3a4a] hover:bg-[#3a4a5a] text-gray-300 rounded text-sm border border-[#3a4a5a] whitespace-nowrap"
                  >
                    {t("record.open_system_settings")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.systemVolume}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, systemVolume: Number(e.target.value) })
                    }
                    className="flex-1 h-1 rounded appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${localSettings.systemVolume}%, #2a3a4a ${localSettings.systemVolume}%, #2a3a4a 100%)`,
                    }}
                  />
                  <span className="text-gray-300 text-sm w-14">{localSettings.systemVolume}%</span>
                </div>
              </div>

              {/* 麦克风声音 */}
              <div className="space-y-3">
                <label className="text-gray-300 text-sm">{t("record.mic_sound")}</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      value={localSettings.micDevice}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, micDevice: e.target.value })
                      }
                      className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-blue-500"
                    >
                      <option value={t("record.device_default")}>{t("record.device_default")}</option>
                      <option value={t("record.built_in_mic")}>{t("record.built_in_mic")}</option>
                      <option value={t("record.external_mic")}>{t("record.external_mic")}</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={openSystemSettings}
                    className="px-4 py-2.5 bg-[#2a3a4a] hover:bg-[#3a4a5a] text-gray-300 rounded text-sm border border-[#3a4a5a] whitespace-nowrap"
                  >
                    {t("record.open_system_settings")}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localSettings.micVolume}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, micVolume: Number(e.target.value) })
                    }
                    className="flex-1 h-1 rounded appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${localSettings.micVolume}%, #2a3a4a ${localSettings.micVolume}%, #2a3a4a 100%)`,
                    }}
                  />
                  <span className="text-gray-300 text-sm w-14">{localSettings.micVolume}%</span>
                </div>
              </div>
            </div>

            {/* 输出设置 */}
            <div ref={outputRef} className="space-y-6 pb-8">
              <h3 className="text-white text-lg font-medium">{t("record.output_settings")}</h3>
              
              <div className="space-y-3">
                <label className="text-gray-300 text-sm">{t("record.output_format")}</label>
                <div className="relative w-80">
                  <select
                    value={localSettings.outputFormat}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, outputFormat: e.target.value })
                    }
                    className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="MP3">MP3</option>
                    <option value="WAV">WAV</option>
                    <option value="FLAC">FLAC</option>
                    <option value="AAC">AAC</option>
                    <option value="OGG">OGG</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-gray-300 text-sm">{t("record.bitrate")}</label>
                <div className="relative w-80">
                  <select
                    value={localSettings.bitrate}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, bitrate: e.target.value })
                    }
                    className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value={t("record.bitrate_64")}>{t("record.bitrate_64")}</option>
                    <option value={t("record.bitrate_128")}>{t("record.bitrate_128")}</option>
                    <option value={t("record.bitrate_192")}>{t("record.bitrate_192")}</option>
                    <option value={t("record.bitrate_256")}>{t("record.bitrate_256")}</option>
                    <option value={t("record.bitrate_320")}>{t("record.bitrate_320")}</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 自动保存 */}
            <div ref={autoSaveRef} className="space-y-6 pb-8">
              <h3 className="text-white text-lg font-medium">{t("record.auto_save")}</h3>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoSaveEnabled"
                  checked={localSettings.autoSaveEnabled}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, autoSaveEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="autoSaveEnabled" className="text-gray-300 text-sm">
                  {t("record.enable_auto_save")}
                </label>
              </div>

              <div className="ml-6 space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoSaveByTime"
                    checked={localSettings.autoSaveByTime}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoSaveByTime: e.target.checked })
                    }
                    disabled={!localSettings.autoSaveEnabled}
                    className="w-4 h-4 accent-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor="autoSaveByTime" className="text-gray-300 text-sm">
                    {t("record.auto_save_time_prefix")}
                  </label>
                  <input
                    type="text"
                    value={localSettings.autoSaveTime}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoSaveTime: e.target.value })
                    }
                    disabled={!localSettings.autoSaveEnabled || !localSettings.autoSaveByTime}
                    className="w-32 bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <span className="text-gray-300 text-sm">{t("record.auto_save_time_suffix")}</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoSaveBySize"
                    checked={localSettings.autoSaveBySize}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoSaveBySize: e.target.checked })
                    }
                    disabled={!localSettings.autoSaveEnabled}
                    className="w-4 h-4 accent-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor="autoSaveBySize" className="text-gray-300 text-sm">
                    {t("record.auto_save_size_prefix")}
                  </label>
                  <input
                    type="text"
                    value={localSettings.autoSaveSize}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoSaveSize: e.target.value })
                    }
                    disabled={!localSettings.autoSaveEnabled || !localSettings.autoSaveBySize}
                    className="w-24 bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <span className="text-gray-300 text-sm">{t("record.auto_save_size_suffix")}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3a4a5a]">
          <button
            onClick={handleResetDefaults}
            className="px-6 py-2 bg-[#2a3a4a] hover:bg-[#3a4a5a] text-gray-300 rounded text-sm border border-[#3a4a5a]"
          >
            {t("record.restore_defaults")}
          </button>
          <button
            onClick={handleConfirm}
            className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            {t("settings.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
