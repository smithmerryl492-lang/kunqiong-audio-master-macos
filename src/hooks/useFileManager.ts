import { useState, useCallback, useMemo } from 'react'

export interface FileItem {
  id: string
  file: File
  name: string
  size: number
  duration?: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export function useFileManager<T extends FileItem>() {
  const [files, setFiles] = useState<T[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const addFiles = useCallback((newFiles: File[], createFileItem: (file: File) => T) => {
    const fileItems = newFiles.map(createFileItem)
    setFiles(prev => [...prev, ...fileItems])
    
    // 自动选中新添加的文件
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      fileItems.forEach(f => newSet.add(f.id))
      return newSet
    })
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }, [])

  const updateFile = useCallback((id: string, updates: Partial<T>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const clearFiles = useCallback(() => {
    setFiles([])
    setSelectedIds(new Set())
  }, [])

  const selectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(files.map(f => f.id)) : new Set())
  }, [files])

  const selectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }, [])

  // 计算派生状态
  const selectedFiles = useMemo(() => 
    files.filter(f => selectedIds.has(f.id)), 
    [files, selectedIds]
  )

  const pendingFiles = useMemo(() => 
    files.filter(f => f.status === 'pending'), 
    [files]
  )

  const completedFiles = useMemo(() => 
    files.filter(f => f.status === 'completed'), 
    [files]
  )

  const isAllSelected = useMemo(() => 
    files.length > 0 && selectedIds.size === files.length, 
    [files.length, selectedIds.size]
  )

  return {
    files,
    selectedIds,
    selectedFiles,
    pendingFiles,
    completedFiles,
    isAllSelected,
    addFiles,
    removeFile,
    updateFile,
    clearFiles,
    selectAll,
    selectOne,
  }
}