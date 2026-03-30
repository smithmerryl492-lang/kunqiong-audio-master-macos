import { X, Plus, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { t } from "../utils/i18n";
import { TimedTask } from "../types/record";

interface TimedRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TimedTask[];
  onAddTask: (task: TimedTask) => void;
  onUpdateTask: (taskId: string, updates: Partial<TimedTask>) => void;
  onDeleteTask: (taskId: string) => void;
}

// 新增/编辑任务弹窗
function AddTaskModal({
  isOpen,
  onClose,
  onSave,
  editingTask,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<TimedTask, "id" | "status">) => void;
  editingTask: TimedTask | null;
}) {
  const now = new Date();
  const formatDateTime = (date: Date) => {
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
  };

  const [startTime, setStartTime] = useState(
    editingTask?.startTime || formatDateTime(now)
  );
  const [durationType, setDurationType] = useState<"duration" | "endTime">(
    editingTask?.durationType || "duration"
  );
  const [duration, setDuration] = useState(editingTask?.duration || "00:10:00");
  const [endTime, setEndTime] = useState(
    editingTask?.endTime ||
      formatDateTime(new Date(now.getTime() + 10 * 60 * 1000))
  );
  const [audioSource, setAudioSource] = useState(
    editingTask?.audioSource || t("timed_record.all_source")
  );
  const [outputFormat, setOutputFormat] = useState(
    editingTask?.outputFormat || "MP3"
  );

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      startTime,
      duration,
      endTime,
      audioSource,
      outputFormat,
      durationType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-[#2a3a50] rounded-lg w-[500px] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-end px-4 py-3">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Start Time */}
          <div className="flex items-center gap-4">
            <label className="text-gray-300 text-sm w-20">{t("timed_record.start_time")}:</label>
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="2025.12.12 11:12:53"
            />
          </div>

          {/* Duration / End Time */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="durationType"
                checked={durationType === "duration"}
                onChange={() => setDurationType("duration")}
                className="w-4 h-4 accent-blue-500"
              />
              <label htmlFor="durationType" className="text-gray-300 text-sm">
                {t("timed_record.duration")}
              </label>
            </div>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={durationType !== "duration"}
              className="w-32 bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="00:10:00"
            />

            <div className="flex items-center gap-2 ml-4">
              <input
                type="radio"
                id="endTimeType"
                checked={durationType === "endTime"}
                onChange={() => setDurationType("endTime")}
                className="w-4 h-4 accent-blue-500"
              />
              <label htmlFor="endTimeType" className="text-gray-300 text-sm">
                {t("timed_record.end_time")}
              </label>
            </div>
            <input
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={durationType !== "endTime"}
              className="flex-1 bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="2025.12.12 12:02:53"
            />
          </div>

          {/* Audio Source & Output Format */}
          <div className="flex items-center gap-4">
            <label className="text-gray-300 text-sm w-20">{t("timed_record.audio_source")}</label>
            <div className="relative flex-1">
              <select
                value={audioSource}
                onChange={(e) => setAudioSource(e.target.value)}
                className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2 pr-8 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value={t("timed_record.all_source")}>{t("timed_record.all_source")}</option>
                <option value={t("timed_record.system_source")}>{t("timed_record.system_source")}</option>
                <option value={t("timed_record.mic_source")}>{t("timed_record.mic_source")}</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            <label className="text-gray-300 text-sm w-20 ml-4">{t("timed_record.output_format")}</label>
            <div className="relative flex-1">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="w-full appearance-none bg-[#1a2a3a] border border-[#3a4a5a] rounded px-3 py-2 pr-8 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="MP3">MP3</option>
                <option value="WAV">WAV</option>
                <option value="FLAC">FLAC</option>
                <option value="AAC">AAC</option>
                <option value="OGG">OGG</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#3a4a5a] hover:bg-[#4a5a6a] text-gray-300 rounded text-sm"
            >
              {t("timed_record.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              {t("timed_record.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimedRecordModal({
  isOpen,
  onClose,
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: TimedRecordModalProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TimedTask | null>(null);

  if (!isOpen) return null;

  const handleAddTask = (taskData: Omit<TimedTask, "id" | "status">) => {
    const newTask: TimedTask = {
      ...taskData,
      id: Math.random().toString(36).substring(2, 9),
      status: "waiting",
    };
    onAddTask(newTask);
  };

  const handleEditTask = (task: TimedTask) => {
    setEditingTask(task);
    setShowAddModal(true);
  };

  const handleUpdateTask = (taskData: Omit<TimedTask, "id" | "status">) => {
    if (!editingTask) return;
    onUpdateTask(editingTask.id, taskData);
    setEditingTask(null);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "waiting":
        return t("timed_record.waiting");
      case "recording":
        return t("timed_record.recording");
      case "completed":
        return t("timed_record.completed");
      case "error":
        return t("timed_record.error");
      default:
        return status;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1e2a3a] rounded-lg w-[800px] shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a4a5a]">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
                <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
                <div className="w-1 h-4 bg-blue-400 rounded-sm"></div>
              </div>
              <span className="text-white text-sm font-medium">{t("timed_record.title")}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-3">
            <button
              onClick={() => {
                setEditingTask(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t("timed_record.add_new")}</span>
            </button>
          </div>

          {/* Table */}
          <div className="px-4 pb-4">
            <div className="bg-[#1a2535] rounded border border-[#3a4a5a] overflow-hidden">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#2a3a4a] text-gray-400 border-b border-[#3a4a5a]">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("timed_record.start_time")}</th>
                    <th className="px-4 py-3 font-medium text-center">{t("timed_record.duration")}</th>
                    <th className="px-4 py-3 font-medium text-center">{t("timed_record.audio_source")}</th>
                    <th className="px-4 py-3 font-medium text-center">{t("timed_record.output_format")}</th>
                    <th className="px-4 py-3 font-medium text-center">{t("timed_record.status")}</th>
                    <th className="px-4 py-3 font-medium text-center">{t("timed_record.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3a4a5a]">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        {t("timed_record.no_tasks")}
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-[#252f3f] transition-colors">
                        <td className="px-4 py-3">{task.startTime}</td>
                        <td className="px-4 py-3 text-center">
                          {task.durationType === "duration" ? task.duration : task.endTime}
                        </td>
                        <td className="px-4 py-3 text-center">{task.audioSource}</td>
                        <td className="px-4 py-3 text-center">{task.outputFormat}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              task.status === "recording"
                                ? "bg-red-500/20 text-red-400"
                                : task.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : task.status === "error"
                                ? "bg-red-900/40 text-red-500"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {getStatusText(task.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditTask(task)}
                              disabled={task.status !== "waiting"}
                              className="p-1.5 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              disabled={task.status === "recording"}
                              className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Task Modal */}
      <AddTaskModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTask(null);
        }}
        onSave={editingTask ? handleUpdateTask : handleAddTask}
        editingTask={editingTask}
      />
    </>
  );
}
