"""
异步任务队列管理
"""
import asyncio
import uuid
from typing import Dict, Any, Callable, Optional
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
import json

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Task:
    id: str
    name: str
    func: Callable
    args: tuple
    kwargs: dict
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    result: Any = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class TaskQueue:
    """异步任务队列"""
    
    def __init__(self, max_concurrent: int = 3):
        self.tasks: Dict[str, Task] = {}
        self.max_concurrent = max_concurrent
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.queue = asyncio.Queue()
        self._worker_started = False
    
    async def start_workers(self):
        """启动工作进程"""
        if self._worker_started:
            return
        
        self._worker_started = True
        for i in range(self.max_concurrent):
            asyncio.create_task(self._worker(f"worker-{i}"))
    
    async def _worker(self, worker_name: str):
        """工作进程"""
        while True:
            try:
                task_id = await self.queue.get()
                if task_id not in self.tasks:
                    continue
                
                task = self.tasks[task_id]
                if task.status != TaskStatus.PENDING:
                    continue
                
                # 执行任务
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now()
                
                try:
                    if asyncio.iscoroutinefunction(task.func):
                        result = await task.func(*task.args, **task.kwargs)
                    else:
                        result = await asyncio.to_thread(task.func, *task.args, **task.kwargs)
                    
                    task.result = result
                    task.status = TaskStatus.COMPLETED
                    task.progress = 100.0
                    
                except Exception as e:
                    task.error = str(e)
                    task.status = TaskStatus.FAILED
                
                finally:
                    task.completed_at = datetime.now()
                    if task_id in self.running_tasks:
                        del self.running_tasks[task_id]
                
            except Exception as e:
                print(f"Worker {worker_name} error: {e}")
            
            finally:
                self.queue.task_done()
    
    async def submit_task(self, name: str, func: Callable, *args, **kwargs) -> str:
        """提交任务"""
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            name=name,
            func=func,
            args=args,
            kwargs=kwargs
        )
        
        self.tasks[task_id] = task
        await self.queue.put(task_id)
        
        # 确保工作进程已启动
        if not self._worker_started:
            await self.start_workers()
        
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务信息"""
        return self.tasks.get(task_id)
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """获取任务状态"""
        task = self.tasks.get(task_id)
        if not task:
            return {"error": "Task not found"}
        
        return {
            "id": task.id,
            "name": task.name,
            "status": task.status.value,
            "progress": task.progress,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "error": task.error
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self.tasks.get(task_id)
        if not task:
            return False
        
        if task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            return True
        
        if task_id in self.running_tasks:
            self.running_tasks[task_id].cancel()
            task.status = TaskStatus.CANCELLED
            return True
        
        return False
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """清理旧任务"""
        cutoff = datetime.now().timestamp() - (max_age_hours * 3600)
        to_remove = []
        
        for task_id, task in self.tasks.items():
            if task.created_at.timestamp() < cutoff and task.status in [
                TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED
            ]:
                to_remove.append(task_id)
        
        for task_id in to_remove:
            del self.tasks[task_id]

# 全局任务队列实例
task_queue = TaskQueue()