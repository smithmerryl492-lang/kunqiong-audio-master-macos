"""
进度跟踪系统
"""
import asyncio
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import json

@dataclass
class ProgressInfo:
    task_id: str
    current: int
    total: int
    message: str
    started_at: datetime
    estimated_remaining: Optional[float] = None
    
    @property
    def percentage(self) -> float:
        if self.total == 0:
            return 0.0
        return min(100.0, (self.current / self.total) * 100)
    
    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "current": self.current,
            "total": self.total,
            "percentage": round(self.percentage, 2),
            "message": self.message,
            "started_at": self.started_at.isoformat(),
            "estimated_remaining": self.estimated_remaining
        }

class ProgressTracker:
    """进度跟踪器"""
    
    def __init__(self):
        self.progress_data: Dict[str, ProgressInfo] = {}
        self.callbacks: Dict[str, list] = {}
    
    def start_tracking(self, task_id: str, total: int, message: str = "Processing..."):
        """开始跟踪任务进度"""
        self.progress_data[task_id] = ProgressInfo(
            task_id=task_id,
            current=0,
            total=total,
            message=message,
            started_at=datetime.now()
        )
        self._notify_callbacks(task_id)
    
    def update_progress(self, task_id: str, current: int, message: str = None):
        """更新进度"""
        if task_id not in self.progress_data:
            return
        
        progress = self.progress_data[task_id]
        progress.current = current
        if message:
            progress.message = message
        
        # 估算剩余时间
        if current > 0:
            elapsed = (datetime.now() - progress.started_at).total_seconds()
            rate = current / elapsed
            remaining_items = progress.total - current
            if rate > 0:
                progress.estimated_remaining = remaining_items / rate
        
        self._notify_callbacks(task_id)
    
    def finish_tracking(self, task_id: str, message: str = "Completed"):
        """完成跟踪"""
        if task_id in self.progress_data:
            progress = self.progress_data[task_id]
            progress.current = progress.total
            progress.message = message
            progress.estimated_remaining = 0
            self._notify_callbacks(task_id)
    
    def get_progress(self, task_id: str) -> Optional[dict]:
        """获取进度信息"""
        if task_id in self.progress_data:
            return self.progress_data[task_id].to_dict()
        return None
    
    def add_callback(self, task_id: str, callback: Callable):
        """添加进度回调"""
        if task_id not in self.callbacks:
            self.callbacks[task_id] = []
        self.callbacks[task_id].append(callback)
    
    def _notify_callbacks(self, task_id: str):
        """通知回调函数"""
        if task_id in self.callbacks:
            progress_dict = self.get_progress(task_id)
            for callback in self.callbacks[task_id]:
                try:
                    callback(progress_dict)
                except Exception as e:
                    print(f"Progress callback error: {e}")
    
    def cleanup_task(self, task_id: str):
        """清理任务数据"""
        if task_id in self.progress_data:
            del self.progress_data[task_id]
        if task_id in self.callbacks:
            del self.callbacks[task_id]

# 全局进度跟踪器
progress_tracker = ProgressTracker()

# 进度跟踪装饰器
def track_progress(task_id_param: str = "task_id", total_param: str = "total"):
    """进度跟踪装饰器"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            task_id = kwargs.get(task_id_param)
            total = kwargs.get(total_param, 100)
            
            if task_id:
                progress_tracker.start_tracking(task_id, total, f"Starting {func.__name__}")
            
            try:
                result = await func(*args, **kwargs)
                if task_id:
                    progress_tracker.finish_tracking(task_id, "Completed successfully")
                return result
            except Exception as e:
                if task_id:
                    progress_tracker.finish_tracking(task_id, f"Failed: {str(e)}")
                raise
        
        def sync_wrapper(*args, **kwargs):
            task_id = kwargs.get(task_id_param)
            total = kwargs.get(total_param, 100)
            
            if task_id:
                progress_tracker.start_tracking(task_id, total, f"Starting {func.__name__}")
            
            try:
                result = func(*args, **kwargs)
                if task_id:
                    progress_tracker.finish_tracking(task_id, "Completed successfully")
                return result
            except Exception as e:
                if task_id:
                    progress_tracker.finish_tracking(task_id, f"Failed: {str(e)}")
                raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator