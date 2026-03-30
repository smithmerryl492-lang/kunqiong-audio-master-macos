import { memo, ReactNode } from 'react'

interface TabWrapperProps {
  tab: string
  activeTab: string
  children: ReactNode
}

// 使用 memo 优化 TabWrapper，避免不必要的重渲染
const OptimizedTabWrapper = memo(({ tab, activeTab, children }: TabWrapperProps) => {
  const isActive = activeTab === tab
  
  return (
    <div 
      className={isActive ? 'flex flex-1 flex-col overflow-hidden' : 'hidden'}
      aria-hidden={!isActive}
      style={{ display: isActive ? 'flex' : 'none' }} // 使用 style 而不是 className 避免重新计算
    >
      {isActive && children} {/* 只在激活时渲染子组件 */}
    </div>
  )
})

OptimizedTabWrapper.displayName = 'OptimizedTabWrapper'

export default OptimizedTabWrapper