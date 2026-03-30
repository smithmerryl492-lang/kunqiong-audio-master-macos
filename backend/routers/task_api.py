"""
任务管理API
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from .task_queue import task_queue, TaskStatus
from .progress_tracker import progress_tracker
from .cache_manager import cache_manager
from utils.i18n import t

router = APIRouter()

@router.post("/submit")
async def submit_async_task(task_name: str, task_data: dict):
    """提交异步任务"""
    # 这里可以根据task_name路由到不同的处理函数
    # 示例实现
    if task_name == "audio_transcribe":
        from .audio_to_text import transcribe_audio_async
        task_id = await task_queue.submit_task(
            t("tags.transcribe"),
            transcribe_audio_async,
            **task_data
        )
    elif task_name == "voice_change":
        from .voice_change import change_voice_async
        task_id = await task_queue.submit_task(
            t("tags.voice"),
            change_voice_async,
            **task_data
        )
    else:
        raise HTTPException(status_code=400, detail=t("errors.processing_failed"))
    
    return {"task_id": task_id, "status": "submitted"}

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """获取任务状态"""
    task_status = task_queue.get_task_status(task_id)
    progress_info = progress_tracker.get_progress(task_id)
    
    result = task_status.copy()
    if progress_info:
        result["progress"] = progress_info
    
    return result

@router.post("/cancel/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    success = task_queue.cancel_task(task_id)
    if success:
        progress_tracker.cleanup_task(task_id)
        return {"message": "Task cancelled successfully"}
    else:
        raise HTTPException(status_code=404, detail="Task not found or cannot be cancelled")

@router.get("/list")
async def list_tasks():
    """列出所有任务"""
    tasks = []
    for task_id, task in task_queue.tasks.items():
        task_info = task_queue.get_task_status(task_id)
        progress_info = progress_tracker.get_progress(task_id)
        if progress_info:
            task_info["progress"] = progress_info
        tasks.append(task_info)
    
    return {"tasks": tasks}

@router.get("/cache/stats")
async def get_cache_stats():
    """获取缓存统计"""
    return cache_manager.get_stats()

@router.post("/cache/clear")
async def clear_cache():
    """清理过期缓存"""
    cache_manager.clear_expired()
    return {"message": "Expired cache cleared"}

@router.get("/system/health")
async def system_health():
    """系统健康检查"""
    import psutil
    import os
    
    # 获取系统资源使用情况
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # 获取任务队列状态
    running_tasks = len([t for t in task_queue.tasks.values() if t.status == TaskStatus.RUNNING])
    pending_tasks = len([t for t in task_queue.tasks.values() if t.status == TaskStatus.PENDING])
    
    return {
        "system": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_gb": round(memory.available / 1024**3, 2),
            "disk_percent": disk.percent,
            "disk_free_gb": round(disk.free / 1024**3, 2)
        },
        "tasks": {
            "running": running_tasks,
            "pending": pending_tasks,
            "total": len(task_queue.tasks)
        },
        "cache": cache_manager.get_stats()
    }