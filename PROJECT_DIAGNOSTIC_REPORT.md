# 音频处理大师：项目 Bug 与功能改进报告 (2026-03-02)

本报告汇总了对“音频处理大师”项目的初步检查结果，涵盖了 26 个核心功能的稳定性分析、代码层面的 Bug 以及用户体验改进建议。

---

## **一、 核心稳定性与 Bug (稳定性风险)**

### **1. 后端 (FastAPI) 共性问题**
- **内存溢出风险 (OOM)（✅ 已修复）**:
  - **位置**: [audio_convert.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_convert.py), [audio_merge.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_merge.py), [audio_to_text.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_to_text.py) 等主要路由。
  - **描述**: 已将 `await file.read()` 统一改为 `save_upload_file` 分块写入磁盘，避免一次性读入内存。
  - **修复状态**: 核心路由已完成重构。

- **FFmpeg 路径寻找失败（✅ 已修复）**:
  - **位置**: 全局工具类 [resource_path.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/resource_path.py) 与 [utils.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/utils.py)。
  - **描述**: 统一封装了 `get_ffmpeg_path()` 和 `run_ffmpeg()`，优先使用 Electron 注入的环境变量或资源目录下的 FFmpeg。
  - **修复状态**: 已在主要路由中应用。

- **临时文件残留（✅ 已修复）**:
  - **位置**: `UPLOAD_DIR`
  - **描述**: 使用 `try...finally` 块确保在任何情况下（成功或失败）都执行清理逻辑。
  - **修复状态**: 已在主要路由中应用。

- **ffprobe 路径硬编码（✅ 已修复）**:
  - **位置**: [audio_merge.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_merge.py), [audio_compress.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_compress.py) 等。
  - **描述**: 统一封装了 `get_ffprobe_path()` 和 `run_ffprobe()`。
  - **修复状态**: 已在相关路由中应用。

- **批量接口清理不一致（✅ 已修复）**:
  - **位置**: [audio_speed.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_speed.py), [audio_denoise.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_denoise.py) 等批量接口。
  - **描述**: 批量接口已统一使用 `try...finally` 包裹每个文件的处理与清理。
  - **修复状态**: 已修复。

- **缺少统一的上传文件大小限制（✅ 已修复）**:
  - **位置**: [utils.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/utils.py) 的 `save_upload_file`。
  - **描述**: 已在 `config.py` 设定 `MAX_UPLOAD_SIZE` (200MB)，并在流式写入时进行限制。
  - **修复状态**: 已修复。

- **TTS 试听临时文件可能无限累积（✅ 已修复）**:
  - **位置**: [text_to_speech.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/text_to_speech.py)
  - **描述**: 增加了 `cleanup_old_previews` 机制，设置了 24 小时的 TTL 清理策略。
  - **修复状态**: 已修复。

- **Windows 下 FFmpeg 子进程可能弹出窗口（✅ 已修复）**:
  - **位置**: [utils.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/utils.py) 的 `run_ffmpeg`。
  - **描述**: 统一设置了 `creationflags=subprocess.CREATE_NO_WINDOW`。
  - **修复状态**: 全局生效。

### **2. 前后端通信问题**
- **动态端口绑定失效（✅ 已修复）**:
  - **位置**: [main.cjs](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/electron/main.cjs) 与 [api.ts](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/src/services/api.ts)
  - **描述**: Electron 启动窗口时已带上 `?backendPort=xxx` 参数，前端已支持从 URL 参数动态获取端口。
  - **修复状态**: 已修复。

- **健康检查端口硬编码（✅ 已修复）**:
  - **位置**: [api.ts](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/src/services/api.ts)
  - **描述**: `healthCheck()` 已改为使用动态端口。
  - **修复状态**: 已修复。

- **硬编码的输出路径（✅ 已修复）**:
  - **位置**: [App.tsx](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/src/App.tsx)
  - **描述**: 已改为启动时向后端请求系统默认桌面路径。
  - **修复状态**: 已修复。

- **前端静态服务器动态端口未同步到窗口加载（✅ 已修复）**:
  - **位置**: [main.cjs](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/electron/main.cjs)
  - **描述**: 调整了启动顺序，先启动服务器确定端口后再加载 URL。
  - **修复状态**: 已修复。

### **3. 安全与授权**
- **机器码不稳定性（✅ 已修复）**:
  - **位置**: [main.cjs](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/electron/main.cjs) 与 [preload.cjs](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/electron/preload.cjs)
  - **描述**: 弃用了不稳定的浏览器指纹，改为在主进程通过 `wmic` 获取主板/CPU序列号，并生成 64 位 SHA256 哈希。
  - **修复状态**: 已修复。

- **语音识别模型参数未生效（✅ 已修复）**:
  - **位置**: [audio_to_text.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_to_text.py)
  - **描述**: 已支持根据 `model_size` 动态加载并缓存不同模型实例。
  - **修复状态**: 已修复。

- **授权校验可被绕过（✅ 已修复）**:
  - **位置**: [main.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/main.py)
  - **描述**: 明确了授权策略，缺少授权头或校验失败将抛出 403/503 异常。
  - **修复状态**: 已修复。

- **CORS 过于宽松 + 文件系统接口暴露本地文件（✅ 已修复）**:
  - **位置**: [main.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/main.py) 与 [file_system.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/file_system.py)
  - **描述**: 限制了 CORS 来源，并对文件预览接口增加了 `UPLOAD_DIR` / `OUTPUT_DIR` 的白名单校验。
  - **修复状态**: 已修复。

- **路径穿越/任意路径读写风险（✅ 已修复）**:
  - **位置**: [utils.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/utils.py) 与 [audio_merge.py](file:///e:/总任务/任务三-鲲穹AI音频转换器/Audio%20Converter/backend/routers/audio_merge.py)
  - **描述**: 强化了文件名净化（强制 `os.path.basename`），并在 `/info` 等接口增加了路径范围校验。
  - **修复状态**: 已修复。

---

## **二、 具体功能点检查 (26项核心功能)**

说明：除“功能特有问题”外，下表各模块普遍受到共性风险影响（FFmpeg/ffprobe 路径、OOM、缺少大小限制、部分批量清理不一致等）。

| 功能模块 | 检查状态 | 潜在问题（除共性风险外） |
| :--- | :--- | :--- |
| **音频转换** | ✅ 已修复 | 输出路径已改为动态获取；FFmpeg 路径已统一。 |
| **音频剪切** | ✅ 已修复 | 依赖已统一封装；批量剪切已增加清理逻辑。 |
| **视频提取音频** | ✅ 已修复 | 增加了 `-map 0:a:0?` 支持多音轨提取。 |
| **音频合并** | ✅ 已修复 | 增加了路径白名单校验。 |
| **音频转文字** | ✅ 已修复 | 模型参数已生效，支持动态加载与缓存。 |
| **人声-伴奏提取** | ✅ 已修复 | 增加了文件名净化与路径校验。 |
| **音量调整** | ✅ 已修复 | 已适配流式写入与统一运行逻辑。 |
| **音频录制** | ✅ 已修复 | 解决了 `ffprobe` 路径问题与临时文件残留。 |
| **音频压缩** | ✅ 已修复 | 适配了统一封装的路径与流式写入。 |
| **音频降噪** | ✅ 已修复 | 适配了流式写入与统一清理。 |
| **音频变速** | ✅ 已修复 | 批量接口已增加统一 `finally` 清理。 |
| **添加背景音** | ✅ 已修复 | 适配了流式写入与时长获取。 |
| **文字转语音** | ✅ 已修复 | 增加了试听文件 TTL 清理机制。 |
| **淡入淡出** | ✅ 已修复 | 适配了流式写入与时长获取。 |
| **音频变声** | ✅ 已修复 | 解决了 OOM 风险，适配了统一运行逻辑。 |
| **视频替换音频** | ✅ 已修复 | 适配了双文件上传流式写入。 |
| **音频倒放** | ✅ 已修复 | 适配了流式写入与统一清理。 |
| **截去静音** | ✅ 已修复 | 适配了流式写入与批量处理清理。 |
| **回声** | ✅ 已修复 | 适配了流式写入与统一运行逻辑。 |
| **均衡器** | ✅ 已修复 | 解决了裁剪拼接时的临时文件残留风险。 |
| **生成噪音** | ✅ 已修复 | 适配了流式写入与采样率获取。 |
| **翻译** | ✅ 已修复 | 文档翻译已限制 2MB 并适配流式读取。 |
| **添加封面** | ✅ 已修复 | 适配了双文件上传流式写入。 |
| **视频消除人声** | ✅ 已修复 | 适配了流式写入与统一运行逻辑。 |
| **人声增强** | ✅ 已修复 | 适配了流式写入与滤镜链构建。 |
| **增加音效** | ✅ 已修复 | 适配了流式写入与批量处理清理。 |

---

## **三、 功能改进建议 (UX & Productivity)**

### **1. 交互体验提升**
- **波形可视化**: 引入拖拽式波形编辑器，替代纯数值输入剪切时间。
- **实时效果预览**: 在处理前提供 3-5 秒的效果试听。
- **全局任务队列**: 增加专门的任务进度管理面板，支持暂停/取消。

### **2. 效率增强**
- **智能静音切分**: 自动检测音频静音部分并批量分割。
- **命名模板**: 支持 `{原文件名}_{日期}` 等自定义命名规则。
- **最近文件记录**: 在主界面显示最近处理过的文件历史。

### **3. 系统集成**
- **系统托盘**: 转换任务后台运行，完成后气泡通知。
- **右键菜单**: 集成到 Windows 资源管理器右键菜单。

---
*报告结束。建议优先修复第一部分中的稳定性 Bug。*
