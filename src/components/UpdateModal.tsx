import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { t } from '../utils/i18n'

export interface UpdateInfo {
  has_update: boolean
  version: string
  update_log: string
  download_url: string
  package_size: number
  package_hash: string
  is_mandatory: boolean
  release_date: string
}

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: UpdateInfo | null
}

export default function UpdateModal({
  isOpen,
  onClose,
  updateInfo
}: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  if (!isOpen || !updateInfo) return null

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      // @ts-ignore
      await window.electron.startUpdate(updateInfo)
    } catch (e) {
      console.error('Update failed:', e)
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1b26] rounded-lg w-[400px] shadow-xl border border-[#2a2b3d]">
        <div className="flex justify-between items-center p-4 border-b border-[#2a2b3d]">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            {t('update.new_version', { version: updateInfo.version })}
          </h3>
          {!updateInfo.is_mandatory && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="p-4 space-y-4">
          <div className="bg-[#12121e] p-3 rounded text-sm text-gray-300 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
            {updateInfo.update_log || t('update.no_log')}
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            {!updateInfo.is_mandatory && (
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                {t('update.remind_later')}
              </button>
            )}
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded flex items-center gap-2 disabled:opacity-50"
            >
              {isUpdating ? t('update.updating') : t('update.update_now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
