import {
  Play,
  Square,
  Mic,
  ChevronDown,
  Trash2,
  Folder,
  FolderOpen,
  Clock,
  Settings,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  saveRecording,
  deleteRecording,
  getDefaultOutputPath,
  selectDirectory,
  openFolder,
} from "../services/api";
import { useAppContext, SharedFile } from "../context/AppContext";
import TimedRecordModal from "./TimedRecordModal";
import RecordSettingsModal, { RecordSettings } from "./RecordSettingsModal";
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'
import { TimedTask } from '../types/record';

interface RecordedFile {
  id: string;
  filename: string;
  duration: number;
  size: number;
  outputPath: string;
}

export default function AudioRecordArea() {
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [systemVolume, setSystemVolume] = useState(100);
  const [micVolume, setMicVolume] = useState(100);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<RecordedFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [outputPath, setOutputPath] = useState("");
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original');
  const [isSaving, setIsSaving] = useState(false);

  const [showTimedModal, setShowTimedModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [timedRecordEnabled, setTimedRecordEnabled] = useState(false);
  const [timedTasks, setTimedTasks] = useState<TimedTask[]>([]);
  const [recordSettings, setRecordSettings] = useState<RecordSettings>({
    systemAudioDevice: t('record.device_default'),
    systemVolume: 100,
    micDevice: t('record.device_default'),
    micVolume: 100,
    outputFormat: "MP3",
    bitrate: t('record.bitrate_cd'),
    autoSaveEnabled: false,
    autoSaveByTime: false,
    autoSaveTime: "00:00:10.000",
    autoSaveBySize: false,
    autoSaveSize: "1.00",
    hotkeys: {
      startStop: t('record.hotkey_start_stop'),
      pause: t('record.hotkey_pause'),
    },
  });

  const { addFilesToModule } = useAppContext();

  // 可添加到的模块列表
  const addToModules = [
    t('functions.audio_convert'),
    t('functions.audio_cut'), 
    t('functions.audio_merge'),
    t('functions.audio_to_text'),
    t('functions.vocal_separate'),
    t('functions.volume_adjust'),
    t('functions.audio_denoise'),
    t('functions.audio_speed'),
    t('functions.add_bgm'),
    t('functions.fade_in_out'),
    t('functions.voice_change'),
    t('functions.audio_reverse'),
    t('functions.remove_silence'),
  ];

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timedDurationRef = useRef<number | null>(null);
  const timedFormatRef = useRef<string | null>(null);
  const timedTaskCheckRef = useRef<number | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const micGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);



  useEffect(() => {
    getDefaultOutputPath().then((path) => setOutputPath(path));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timedTaskCheckRef.current) clearInterval(timedTaskCheckRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // 定时任务检查 - 在父组件中执行，弹窗关闭也能工作
  useEffect(() => {
    const checkTimedTasks = () => {
      if (isRecording) return; // 正在录制时不检查
      
      const now = new Date();
      
      // 先找到需要启动的任务
      const taskToStart = timedTasks.find((task) => {
        if (task.status !== "waiting") return false;
        
        // 解析开始时间
        const [datePart, timePart] = task.startTime.split(" ");
        const [year, month, day] = datePart.split(".").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);
        const startDate = new Date(year, month - 1, day, hour, minute, second);
        
        return now >= startDate;
      });

      // 如果有任务需要开始
      if (taskToStart) {
        // 更新任务状态
        setTimedTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskToStart.id
              ? { ...task, status: "recording" as const }
              : task
          )
        );

        // 启动录制
        const [dh, dm, ds] = taskToStart.duration.split(":").map(Number);
        const durationSeconds = dh * 3600 + dm * 60 + ds;
        
        setTimeout(() => {
          startTimedRecordingInternal(durationSeconds, taskToStart.outputFormat);
        }, 100);
      }
    };

    // 每秒检查一次
    timedTaskCheckRef.current = window.setInterval(checkTimedTasks, 1000);

    return () => {
      if (timedTaskCheckRef.current) {
        clearInterval(timedTaskCheckRef.current);
      }
    };
  }, [isRecording, timedTasks]);

  // 当录制停止时，更新任务状态
  useEffect(() => {
    if (!isRecording && timedTasks.some(t => t.status === "recording")) {
      setTimedTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.status === "recording" ? { ...task, status: "completed" as const } : task
        )
      );
    }
  }, [isRecording]);

  // 实时更新麦克风音量
  useEffect(() => {
    if (micGainRef.current && isRecording) {
      micGainRef.current.gain.value = micVolume / 100;
    }
  }, [micVolume, isRecording]);

  // 实时更新系统音量
  useEffect(() => {
    if (systemGainRef.current && isRecording) {
      systemGainRef.current.gain.value = systemVolume / 100;
    }
  }, [systemVolume, isRecording]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatDurationHMS = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 绘制波形
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barCount = 60;
      const barWidth = canvas.width / barCount - 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[dataIndex] / 255;
        const barHeight = value * centerY * 0.9;

        // 渐变颜色从绿色到黄色
        const gradient = ctx.createLinearGradient(
          0,
          centerY - barHeight,
          0,
          centerY + barHeight
        );
        gradient.addColorStop(0, "#22c55e");
        gradient.addColorStop(0.5, "#4ade80");
        gradient.addColorStop(1, "#22c55e");

        ctx.fillStyle = gradient;

        // 上半部分
        ctx.fillRect(
          i * (barWidth + 2) + 1,
          centerY - barHeight,
          barWidth,
          barHeight
        );
        // 下半部分（镜像）
        ctx.fillRect(i * (barWidth + 2) + 1, centerY, barWidth, barHeight);
      }
    };

    draw();
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // 创建音频上下文
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // 创建目标节点用于混合音频
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // 创建增益节点用于音量控制
      micGainRef.current = audioContextRef.current.createGain();
      systemGainRef.current = audioContextRef.current.createGain();
      
      // 设置初始音量
      micGainRef.current.gain.value = micVolume / 100;
      systemGainRef.current.gain.value = systemVolume / 100;
      
      let hasAudioSource = false;
      
      // 1. 尝试获取麦克风音频
      if (micVolume > 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = micStream;
          
          const micSource = audioContextRef.current.createMediaStreamSource(micStream);
          micSource.connect(micGainRef.current);
          micGainRef.current.connect(destinationRef.current);
          micGainRef.current.connect(analyserRef.current);
          hasAudioSource = true;
          console.log(t('record.mic_connected'));
        } catch (micError) {
          console.warn(t('record.mic_unavailable'), micError);
        }
      }
      
      // 2. 尝试获取系统音频（仅在 Electron 环境中）
      if (systemVolume > 0 && (window as any).electron?.getDesktopSources) {
        try {
          const sources = await (window as any).electron.getDesktopSources();
          console.log(t('record.available_desktop_sources'), sources);
          
          if (sources && sources.length > 0) {
            // 优先选择整个屏幕
            const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
            
            // 使用 chromeMediaSource 获取系统音频
            const systemStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                // @ts-ignore - Electron 特有的约束
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id,
                }
              },
              video: {
                // @ts-ignore - 需要视频约束才能获取音频，但我们不使用视频
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id,
                  maxWidth: 1,
                  maxHeight: 1,
                  maxFrameRate: 1,
                }
              }
            } as any);
            
            // 只保留音频轨道，停止视频轨道
            systemStream.getVideoTracks().forEach(track => track.stop());
            
            const audioTracks = systemStream.getAudioTracks();
            if (audioTracks.length > 0) {
              systemStreamRef.current = new MediaStream(audioTracks);
              
              const systemSource = audioContextRef.current!.createMediaStreamSource(systemStreamRef.current);
              systemSource.connect(systemGainRef.current!);
              systemGainRef.current!.connect(destinationRef.current!);
              systemGainRef.current!.connect(analyserRef.current!);
              hasAudioSource = true;
              console.log(t('record.system_audio_connected'));
            }
          }
        } catch (systemError) {
          console.warn(t('record.system_audio_unavailable'), systemError);
          if (navigator.platform.toLowerCase().includes('mac')) {
            alert(
              t('record.system_audio_unavailable') ||
              '当前 macOS 环境下系统音频录制未成功开启，请确认已授予屏幕录制与音频捕获权限。'
            );
          }
          // 系统音频获取失败不影响麦克风录制
        }
      }
      
      if (!hasAudioSource) {
        throw new Error(t('record.no_audio_source'));
      }
      
      // 使用混合后的音频流进行录制
      const combinedStream = destinationRef.current.stream;
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await saveRecordingFile(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          // 检查是否达到定时录制时长
          if (timedDurationRef.current && newTime >= timedDurationRef.current) {
            // 使用 setTimeout 确保在下一个事件循环中停止录制
            setTimeout(() => {
              stopRecordingInternal();
            }, 0);
          }
          return newTime;
        });
      }, 1000);
    } catch (error: any) {
      console.error("录制启动失败:", error);
      if (error.name === "NotAllowedError") {
        alert(t('record.mic_permission_denied') || "麦克风权限被拒绝，请在浏览器设置中允许麦克风访问");
      } else if (error.name === "NotFoundError") {
        alert(t('record.no_mic_device') || "未检测到麦克风设备，请连接麦克风后重试");
      } else {
        alert((t('record.start_failed') || "录制启动失败: ") + error.message);
      }
    }
  };

  // 开始绘制波形
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      drawWaveform();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, drawWaveform]);

  // 内部停止录制函数，使用 ref 检查状态
  const stopRecordingInternal = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach((track) => track.stop());
        systemStreamRef.current = null;
      }
      setIsRecording(false);
      isRecordingRef.current = false;
      timedDurationRef.current = null;
      timedFormatRef.current = null;
    }
  };

  const stopRecording = () => {
    stopRecordingInternal();
  };

  // 定时录制启动函数（内部使用）
  const startTimedRecordingInternal = async (duration: number, format: string) => {
    timedDurationRef.current = duration;
    timedFormatRef.current = format;
    setOutputFormat(format.toLowerCase());
    setTimedRecordEnabled(true);
    await startRecording();
  };

  // 添加定时任务
  const addTimedTask = (task: TimedTask) => {
    setTimedTasks((prev) => [...prev, task]);
    setTimedRecordEnabled(true);
  };

  // 更新定时任务
  const updateTimedTask = (taskId: string, updates: Partial<TimedTask>) => {
    setTimedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  // 删除定时任务
  const deleteTimedTask = (taskId: string) => {
    setTimedTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (timedTasks.length <= 1) {
      setTimedRecordEnabled(false);
    }
  };

  const saveRecordingFile = async (blob: Blob) => {
    setIsSaving(true);
    const savedTime = recordingTime;
    try {
      const result = await saveRecording(blob, outputFormat, outputPath);

      const newRecording: RecordedFile = {
        id: Math.random().toString(36).substring(2, 9),
        filename: result.filename,
        duration: result.duration || savedTime,
        size: result.size,
        outputPath: result.output_path,
      };

      setRecordings((prev) => [...prev, newRecording]);
      setSelectedIds((prev) => new Set(prev).add(newRecording.id));
    } catch (error) {
      console.error(t('record.save_failed'), error);
      alert(t('record.save_failed'));
    } finally {
      setIsSaving(false);
      setRecordingTime(0);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(recordings.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteRecording = async (recording: RecordedFile) => {
    try {
      await deleteRecording(recording.outputPath);
      setRecordings((prev) => prev.filter((r) => r.id !== recording.id));
      selectedIds.delete(recording.id);
      setSelectedIds(new Set(selectedIds));
    } catch (error) {
      console.error(t('record.delete_failed'), error);
    }
  };

  const handleBatchDelete = async () => {
    const toDelete = recordings.filter((r) => selectedIds.has(r.id));
    for (const recording of toDelete) {
      try {
        await deleteRecording(recording.outputPath);
      } catch (error) {
        console.error(t('record.delete_failed'), error);
      }
    }
    setRecordings((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
  };

  const handleSelectDirectory = async () => {
    const result = await selectDirectory(outputPath);
    if (result.success && result.path) {
      setOutputPath(result.path);
    }
  };

  const handleOpenFolder = async () => {
    await openOutputFolder(outputPath);
  };

  const handleOpenRecordingFolder = async (recording: RecordedFile) => {
    const folderPath = recording.outputPath.substring(0, Math.max(
      recording.outputPath.lastIndexOf("/"),
      recording.outputPath.lastIndexOf("\\")
    ));
    await openOutputFolder(folderPath || outputPath);
  };

  // 添加单个录音到指定模块
  const handleAddToModule = (recording: RecordedFile, module: string) => {
    const sharedFile: SharedFile = {
      id: recording.id,
      name: recording.filename,
      path: recording.outputPath,
      size: recording.size,
      duration: recording.duration,
    };
    addFilesToModule(module, [sharedFile]);
  };

  // 批量添加选中的录音到指定模块
  const handleBatchAddToModule = (module: string) => {
    const selectedRecordings = recordings.filter((r) => selectedIds.has(r.id));
    const sharedFiles: SharedFile[] = selectedRecordings.map((r) => ({
      id: r.id,
      name: r.filename,
      path: r.outputPath,
      size: r.size,
      duration: r.duration,
    }));
    addFilesToModule(module, sharedFiles);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a14]">
      <div className="flex-1 flex">
        {/* Left Panel */}
        <div className="w-[480px] flex flex-col border-r border-[#1e2235] p-4">
          {/* Waveform Display */}
          <div className="bg-[#0d1117] rounded-lg h-40 mb-4 flex items-center justify-center overflow-hidden border border-[#1e2235]">
            {isRecording ? (
              <canvas
                ref={canvasRef}
                width={440}
                height={140}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center gap-1 w-full h-full">
                {/* 静态波形占位 */}
                {Array.from({ length: 60 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-[#1e2235] rounded-full"
                    style={{
                      height: `${Math.random() * 30 + 10}%`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recording Time */}
          <div className="text-3xl font-mono text-white mb-6">
            {formatTime(recordingTime)}
          </div>

          {/* Volume Controls */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                {t('record.system_volume')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={systemVolume}
                  onChange={(e) => setSystemVolume(Number(e.target.value))}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${systemVolume}%, #2a2a40 ${systemVolume}%, #2a2a40 100%)`,
                  }}
                />
                <span className="text-gray-300 text-xs w-12">
                  {systemVolume}%
                </span>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block">
                {t('record.mic_volume')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={micVolume}
                  onChange={(e) => setMicVolume(Number(e.target.value))}
                  className="flex-1 h-1 rounded appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${micVolume}%, #2a2a40 ${micVolume}%, #2a2a40 100%)`,
                  }}
                />
                <span className="text-gray-300 text-xs w-12">{micVolume}%</span>
              </div>
            </div>
          </div>

          {/* Record Buttons */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSaving}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                isRecording
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30"
                  : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700"
              } disabled:opacity-50`}
            >
              {isRecording ? (
                <Play className="w-6 h-6 text-white ml-0.5" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>

            {isRecording && (
              <button
                onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 hover:from-red-600 hover:to-red-700"
              >
                <Square className="w-6 h-6 text-white" fill="white" />
              </button>
            )}
          </div>

          {/* Bottom Options */}
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-auto">
            <button 
              onClick={() => setShowTimedModal(true)}
              className={`flex items-center gap-1.5 hover:text-white ${timedRecordEnabled ? 'text-blue-400' : ''}`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('record.timed_record')}({timedRecordEnabled ? t('settings.on') : t('settings.off')})</span>
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-1.5 hover:text-white"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t('record.record_settings')}</span>
            </button>
          </div>
        </div>

        {/* Right Panel - Recording List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2235]">
            <span className="text-gray-300 text-sm">{t('record.record_list', { count: recordings.length })}</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select 
                  className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-blue-400 outline-none"
                  onChange={(e) => {
                    if (e.target.value && selectedIds.size > 0) {
                      handleBatchAddToModule(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  disabled={selectedIds.size === 0}
                >
                  <option value="">{t('record.add_to_module')}</option>
                  {addToModules.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
              </div>
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 text-gray-400 hover:text-red-400 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('common.batch_delete') || '批量移除'}</span>
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
            <div className="w-8">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-blue-500"
                checked={
                  recordings.length > 0 &&
                  selectedIds.size === recordings.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </div>
            <div className="flex-1">{t('common.file_name') || '文件名'}</div>
            <div className="w-24 text-center">{t('record.duration')}</div>
            <div className="w-64 text-center">{t('common.action') || '操作'}</div>
          </div>

          {/* Recording List */}
          <div className="flex-1 overflow-auto">
            {recordings.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-gray-600 text-xs">{t('common.no_files') || '暂无录制文件'}</p>
              </div>
            ) : (
              recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center bg-[#0d0d1a] hover:bg-[#12121e] px-4 py-2.5 text-xs text-gray-300 border-b border-[#1e2235]"
                >
                  <div className="w-8">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-blue-500"
                      checked={selectedIds.has(recording.id)}
                      onChange={(e) =>
                        handleSelectOne(recording.id, e.target.checked)
                      }
                    />
                  </div>
                  <div className="flex-1 truncate flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="truncate">{recording.filename}</span>
                  </div>
                  <div className="w-24 text-center text-gray-400">
                    {formatDurationHMS(recording.duration)}
                  </div>
                  <div className="w-64 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenRecordingFolder(recording)}
                      className="px-3 py-1 text-gray-400 hover:text-white border border-[#2a2a40] rounded text-xs whitespace-nowrap"
                    >
                      {OPEN_FOLDER_TEXT}
                    </button>
                    <div className="relative">
                      <select 
                        className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-3 py-1 pr-6 text-xs text-gray-300 outline-none min-w-[80px]"
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddToModule(recording, e.target.value);
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">{t('record.add_to_module')}</option>
                        {addToModules.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => handleDeleteRecording(recording)}
                      className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 bg-[#12121e] border-t border-[#1e2235] flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'original'} onChange={() => setOutputType('original')} className="w-3 h-3 accent-blue-500" />
              <span>{t('footer.original_dir')}</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'custom'} onChange={() => setOutputType('custom')} className="w-3 h-3 accent-blue-500" />
              <span>{t('footer.custom_dir')}</span>
            </label>
          </div>
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            disabled={outputType === 'original'}
            className={`w-72 bg-[#0a0a14] border border-[#2a2a40] rounded px-2 py-1.5 text-xs outline-none ${outputType === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectDirectory}
            disabled={outputType === 'original'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-[#2a2a40] ${outputType === 'original' ? 'bg-[#1a1a2a] text-gray-500 cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300'}`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t('footer.change')}</span>
          </button>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{OPEN_FOLDER_TEXT}</span>
          </button>
        </div>
      </div>

      {/* Timed Record Modal */}
      <TimedRecordModal
        isOpen={showTimedModal}
        onClose={() => setShowTimedModal(false)}
        tasks={timedTasks}
        onAddTask={addTimedTask}
        onUpdateTask={updateTimedTask}
        onDeleteTask={deleteTimedTask}
      />

      {/* Settings Modal */}
      <RecordSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={recordSettings}
        onSave={(newSettings) => {
          setRecordSettings(newSettings);
          setSystemVolume(newSettings.systemVolume);
          setMicVolume(newSettings.micVolume);
          setOutputFormat(newSettings.outputFormat.toLowerCase());
        }}
      />
    </div>
  );
}
