import { Check, Loader2, X, Clock } from 'lucide-react'
import { t } from '../utils/i18n'

interface ProcessingStatusProps {
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

const getStatusConfig = () => ({
  pending: {
    icon: Clock,
    text: `⊙${t('common.status.pending')}`,
    className: 'text-gray-500',
    animate: false
  },
  processing: {
    icon: Loader2,
    text: t('common.status.converting'),
    className: 'text-blue-400',
    animate: true
  },
  completed: {
    icon: Check,
    text: `✓${t('common.status.done')}`,
    className: 'text-green-400',
    animate: false
  },
  error: {
    icon: X,
    text: `✗${t('common.status.error')}`,
    className: 'text-red-400',
    animate: false
  }
})

const sizeConfig = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
}

export default function ProcessingStatus({ status, error, size = 'sm' }: ProcessingStatusProps) {
  const config = getStatusConfig()[status]
  const Icon = config.icon
  
  return (
    <div className={`flex items-center justify-center gap-1 ${sizeConfig[size]}`}>
      <Icon 
        className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} 
      />
      <span 
        className={config.className}
        title={status === 'error' ? error : undefined}
      >
        {config.text}
      </span>
    </div>
  )
}