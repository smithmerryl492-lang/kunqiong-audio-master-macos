import { useState, useRef, useEffect, useCallback } from 'react'

interface EnhancedSliderProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  showValue?: boolean
  unit?: string
  color?: 'blue' | 'green' | 'orange' | 'purple'
  size?: 'sm' | 'md' | 'lg'
}

export default function EnhancedSlider({
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
  className = '',
  showValue = false,
  unit = '',
  color = 'blue',
  size = 'md'
}: EnhancedSliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [dragValue, setDragValue] = useState(value)
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const lastValueRef = useRef(value)

  const percentage = ((dragValue - min) / (max - min)) * 100

  const colorClasses = {
    blue: {
      track: 'bg-[#2a3a50]',
      fill: 'bg-gradient-to-r from-blue-600 to-blue-400',
      thumb: 'bg-gradient-to-b from-blue-400 to-blue-600 border-blue-300',
      thumbHover: 'hover:from-blue-300 hover:to-blue-500 hover:border-blue-200',
      thumbActive: 'from-blue-300 to-blue-500 border-blue-200 shadow-blue-500/50',
      tooltip: 'bg-blue-600 border-blue-500'
    },
    green: {
      track: 'bg-[#2a4a30]',
      fill: 'bg-gradient-to-r from-green-600 to-green-400',
      thumb: 'bg-gradient-to-b from-green-400 to-green-600 border-green-300',
      thumbHover: 'hover:from-green-300 hover:to-green-500 hover:border-green-200',
      thumbActive: 'from-green-300 to-green-500 border-green-200 shadow-green-500/50',
      tooltip: 'bg-green-600 border-green-500'
    },
    orange: {
      track: 'bg-[#4a3a2a]',
      fill: 'bg-gradient-to-r from-orange-600 to-orange-400',
      thumb: 'bg-gradient-to-b from-orange-400 to-orange-600 border-orange-300',
      thumbHover: 'hover:from-orange-300 hover:to-orange-500 hover:border-orange-200',
      thumbActive: 'from-orange-300 to-orange-500 border-orange-200 shadow-orange-500/50',
      tooltip: 'bg-orange-600 border-orange-500'
    },
    purple: {
      track: 'bg-[#3a2a4a]',
      fill: 'bg-gradient-to-r from-purple-600 to-purple-400',
      thumb: 'bg-gradient-to-b from-purple-400 to-purple-600 border-purple-300',
      thumbHover: 'hover:from-purple-300 hover:to-purple-500 hover:border-purple-200',
      thumbActive: 'from-purple-300 to-purple-500 border-purple-200 shadow-purple-500/50',
      tooltip: 'bg-purple-600 border-purple-500'
    }
  }

  const sizeClasses = {
    sm: {
      container: 'h-3',
      track: 'h-1',
      thumb: 'w-3 h-3',
      tooltip: 'text-xs px-1.5 py-0.5'
    },
    md: {
      container: 'h-4',
      track: 'h-2',
      thumb: 'w-4 h-4',
      tooltip: 'text-xs px-2 py-1'
    },
    lg: {
      container: 'h-5',
      track: 'h-3',
      thumb: 'w-5 h-5',
      tooltip: 'text-sm px-2 py-1'
    }
  }

  const colors = colorClasses[color]
  const sizes = sizeClasses[size]

  const formatValue = (value: number) => {
    // 去掉末尾的0，保留最多1位小数
    return parseFloat(value.toFixed(step < 1 ? 1 : 0)).toString()
  }

  // 同步外部值变化
  useEffect(() => {
    if (!isDraggingRef.current) {
      setDragValue(value)
      lastValueRef.current = value
    }
  }, [value])

  const updateTooltipPosition = useCallback(() => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect()
      const thumbX = rect.left + (rect.width * percentage / 100)
      const thumbY = rect.top - 35
      setTooltipPosition({ x: thumbX, y: thumbY })
    }
  }, [percentage])

  const calculateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return lastValueRef.current
    
    const rect = sliderRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const percentage = x / rect.width
    const rawValue = min + percentage * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    return Math.max(min, Math.min(max, steppedValue))
  }, [min, max, step])

  const updateValue = useCallback((clientX: number) => {
    const newValue = calculateValue(clientX)
    if (newValue !== lastValueRef.current) {
      lastValueRef.current = newValue
      setDragValue(newValue)
      onChange(newValue)
      updateTooltipPosition()
    }
  }, [calculateValue, onChange, updateTooltipPosition])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    
    isDraggingRef.current = true
    setIsDragging(true)
    setShowTooltip(true)
    
    updateValue(e.clientX)
    
    // 立即捕获指针
    const target = e.currentTarget as HTMLElement
    if (target.setPointerCapture && (e as any).pointerId) {
      target.setPointerCapture((e as any).pointerId)
    }
  }, [disabled, updateValue])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    updateValue(e.clientX)
  }, [updateValue])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    
    isDraggingRef.current = false
    setIsDragging(false)
    setShowTooltip(false)
    
    // 释放指针捕获
    const target = e.target as HTMLElement
    if (target.releasePointerCapture && (e as any).pointerId) {
      target.releasePointerCapture((e as any).pointerId)
    }
  }, [])

  // 使用更高频率的事件监听
  useEffect(() => {
    if (!isDragging) return

    // 使用 capture 阶段确保事件优先级
    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: false })
    document.addEventListener('mouseup', handleMouseUp, { capture: true, passive: false })
    
    // 添加指针事件以获得更好的响应性
    document.addEventListener('pointermove', handleMouseMove as any, { capture: true, passive: false })
    document.addEventListener('pointerup', handleMouseUp as any, { capture: true, passive: false })
    
    // 添加触摸事件支持
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMouseMove({ clientX: e.touches[0].clientX } as MouseEvent)
      }
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      handleMouseUp(e as any)
    }
    
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false })
    document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false })

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true } as any)
      document.removeEventListener('mouseup', handleMouseUp, { capture: true } as any)
      document.removeEventListener('pointermove', handleMouseMove as any, { capture: true } as any)
      document.removeEventListener('pointerup', handleMouseUp as any, { capture: true } as any)
      document.removeEventListener('touchmove', handleTouchMove, { capture: true } as any)
      document.removeEventListener('touchend', handleTouchEnd, { capture: true } as any)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // 优化提示框位置更新
  useEffect(() => {
    if (showTooltip) {
      updateTooltipPosition()
    }
  }, [showTooltip, dragValue, updateTooltipPosition])

  return (
    <>
      <div className={`relative flex items-center ${sizes.container} ${className}`}>
        {/* 滑块轨道 */}
        <div
          ref={sliderRef}
          className={`relative w-full ${sizes.track} ${colors.track} rounded-full cursor-pointer select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onMouseDown={handleMouseDown}
          onPointerDown={handleMouseDown as any}
          onMouseEnter={() => {
            if (!disabled) {
              setShowTooltip(true)
              updateTooltipPosition()
            }
          }}
          onMouseLeave={() => !isDragging && setShowTooltip(false)}
          style={{ 
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          {/* 填充部分 */}
          <div
            className={`absolute left-0 top-0 ${sizes.track} ${colors.fill} rounded-full`}
            style={{ 
              width: `${percentage}%`,
              transition: isDragging ? 'none' : 'width 150ms ease-out',
              willChange: 'width'
            }}
          />
          
          {/* 滑块手柄 */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${sizes.thumb} ${colors.thumb} ${
              disabled ? '' : colors.thumbHover
            } ${
              isDragging ? colors.thumbActive : ''
            } rounded-full border-2 shadow-lg cursor-pointer select-none ${
              isDragging ? 'scale-110' : 'hover:scale-105'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ 
              left: `${percentage}%`, 
              transform: 'translate(-50%, -50%)',
              transition: isDragging ? 'none' : 'all 150ms ease-out',
              willChange: 'transform'
            }}
            onMouseDown={handleMouseDown}
            onPointerDown={handleMouseDown as any}
          />
        </div>

        {/* 数值显示 */}
        {showValue && (
          <div className="ml-2 min-w-[3rem] text-xs text-gray-300 font-mono">
            {formatValue(dragValue)}{unit}
          </div>
        )}
      </div>

      {/* 悬停提示 - 使用 Portal 渲染到 body */}
      {showTooltip && !disabled && (
        <div
          className={`fixed ${sizes.tooltip} ${colors.tooltip} border text-white rounded shadow-lg pointer-events-none transition-opacity duration-150`}
          style={{ 
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 9999
          }}
        >
          {formatValue(dragValue)}{unit}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-current" />
        </div>
      )}
    </>
  )
}