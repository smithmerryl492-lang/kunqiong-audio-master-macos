import { Plus, FolderPlus, Music, FileAudio, Trash2 } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void
  accept?: string
  multiple?: boolean
  description?: string
  subDescription?: string
  hasFiles?: boolean
  children?: React.ReactNode
  showButtons?: boolean
  showClearButton?: boolean
  onClear?: () => void
  className?: string
}

export default function FileDropZone({
  onFilesAdded,
  accept = 'audio/*,.mp3,.wav,.m4a,.flac,.ogg,.wma,.aac,.webm',
  multiple = true,
  description = '拖拽文件至此处 或 点击添加文件',
  subDescription = '支持 MP3, WAV, M4A, FLAC, OGG 等格式',
  hasFiles = false,
  children,
  showButtons = true,
  showClearButton = true,
  onClear,
  className = ''
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  const acceptExtensions = accept.split(',').map(ext => ext.trim().toLowerCase())
  const allowAudio = acceptExtensions.includes('audio/*')
  const allowVideo = acceptExtensions.includes('video/*')

  const filterFiles = useCallback((files: FileList | File[]): File[] => {
    return Array.from(files).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase()
      if (allowAudio && f.type.startsWith('audio/')) return true
      if (allowVideo && f.type.startsWith('video/')) return true
      return acceptExtensions.some(accepted => accepted === ext)
    })
  }, [acceptExtensions, allowAudio, allowVideo])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const filtered = filterFiles(e.dataTransfer.files)
      if (filtered.length > 0) {
        onFilesAdded(filtered)
      }
    }
  }, [filterFiles, onFilesAdded])

  // 使用原生事件监听器，绑定到整个容器
  useEffect(() => {
    const element = dropZoneRef.current
    if (!element) return

    // 使用 capture 阶段确保事件被捕获
    element.addEventListener('dragenter', handleDragEnter, true)
    element.addEventListener('dragleave', handleDragLeave, true)
    element.addEventListener('dragover', handleDragOver, true)
    element.addEventListener('drop', handleDrop, true)

    return () => {
      element.removeEventListener('dragenter', handleDragEnter, true)
      element.removeEventListener('dragleave', handleDragLeave, true)
      element.removeEventListener('dragover', handleDragOver, true)
      element.removeEventListener('drop', handleDrop, true)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filtered = filterFiles(e.target.files)
      if (filtered.length > 0) {
        onFilesAdded(filtered)
      }
    }
    e.target.value = ''
  }

  return (
    <div ref={dropZoneRef} className={`flex-1 flex flex-col relative ${className}`}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

      {/* Top Action Bar */}
      {showButtons && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleFileSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加文件</span>
            </button>
            <button
              onClick={handleFolderSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>添加文件夹</span>
            </button>
          </div>
          {showClearButton && onClear && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空列表</span>
            </button>
          )}
        </div>
      )}

      {/* Drop Zone / Content Area */}
      <div
        className={`flex-1 flex flex-col transition-colors rounded-lg ${
          isDragging ? 'bg-blue-500/20 border-2 border-dashed border-blue-500' : ''
        } ${!hasFiles ? 'border border-dashed border-[#2a3a50] hover:border-[#3a4a60] cursor-pointer' : ''}`}
        onClick={hasFiles ? undefined : handleFileSelect}
      >
        {hasFiles ? (
          children
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center border border-[#2a3a50]">
                <FileAudio className="w-10 h-10 text-blue-400/60" />
              </div>
              <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                <Music className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mb-2">{description}</p>
            <p className="text-gray-600 text-[10px]">{subDescription}</p>
          </div>
        )}
      </div>

      {/* 拖拽覆盖层提示 */}
      {isDragging && hasFiles && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-blue-400 text-sm font-medium">释放文件以添加</div>
        </div>
      )}
    </div>
  )
}
