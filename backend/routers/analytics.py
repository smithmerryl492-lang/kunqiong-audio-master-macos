"""
使用统计和分析
"""
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import threading

@dataclass
class UsageEvent:
    timestamp: str
    feature: str
    action: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    processing_time: Optional[float] = None
    success: bool = True
    error_message: Optional[str] = None
    user_agent: Optional[str] = None

class AnalyticsManager:
    """使用分析管理器"""
    
    def __init__(self, db_path: str = "analytics.db"):
        self.db_path = Path(db_path)
        self._lock = threading.Lock()
        self._init_database()
    
    def _init_database(self):
        """初始化数据库"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS usage_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    feature TEXT NOT NULL,
                    action TEXT NOT NULL,
                    file_type TEXT,
                    file_size INTEGER,
                    processing_time REAL,
                    success BOOLEAN NOT NULL,
                    error_message TEXT,
                    user_agent TEXT
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_events(timestamp)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_feature ON usage_events(feature)
            """)
    
    def log_event(self, event: UsageEvent):
        """记录使用事件"""
        with self._lock:
            try:
                with sqlite3.connect(self.db_path) as conn:
                    conn.execute("""
                        INSERT INTO usage_events 
                        (timestamp, feature, action, file_type, file_size, 
                         processing_time, success, error_message, user_agent)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        event.timestamp, event.feature, event.action,
                        event.file_type, event.file_size, event.processing_time,
                        event.success, event.error_message, event.user_agent
                    ))
            except Exception as e:
                print(f"Analytics logging error: {e}")
    
    def get_usage_stats(self, days: int = 30) -> Dict:
        """获取使用统计"""
        start_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # 总体统计
            total_events = conn.execute(
                "SELECT COUNT(*) as count FROM usage_events WHERE timestamp >= ?",
                (start_date,)
            ).fetchone()["count"]
            
            # 成功率
            success_rate = conn.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
                FROM usage_events 
                WHERE timestamp >= ?
            """, (start_date,)).fetchone()
            
            success_percentage = 0
            if success_rate["total"] > 0:
                success_percentage = (success_rate["successful"] / success_rate["total"]) * 100
            
            # 功能使用排行
            feature_stats = conn.execute("""
                SELECT feature, COUNT(*) as count
                FROM usage_events 
                WHERE timestamp >= ?
                GROUP BY feature
                ORDER BY count DESC
                LIMIT 10
            """, (start_date,)).fetchall()
            
            # 每日使用量
            daily_usage = conn.execute("""
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as count
                FROM usage_events 
                WHERE timestamp >= ?
                GROUP BY DATE(timestamp)
                ORDER BY date DESC
                LIMIT 30
            """, (start_date,)).fetchall()
            
            # 平均处理时间
            avg_processing_time = conn.execute("""
                SELECT 
                    feature,
                    AVG(processing_time) as avg_time,
                    COUNT(*) as count
                FROM usage_events 
                WHERE timestamp >= ? AND processing_time IS NOT NULL
                GROUP BY feature
                ORDER BY avg_time DESC
            """, (start_date,)).fetchall()
            
            # 错误统计
            error_stats = conn.execute("""
                SELECT 
                    feature,
                    error_message,
                    COUNT(*) as count
                FROM usage_events 
                WHERE timestamp >= ? AND success = 0
                GROUP BY feature, error_message
                ORDER BY count DESC
                LIMIT 10
            """, (start_date,)).fetchall()
            
            return {
                "period_days": days,
                "total_events": total_events,
                "success_rate": round(success_percentage, 2),
                "feature_usage": [dict(row) for row in feature_stats],
                "daily_usage": [dict(row) for row in daily_usage],
                "avg_processing_time": [dict(row) for row in avg_processing_time],
                "error_stats": [dict(row) for row in error_stats]
            }
    
    def get_popular_features(self, limit: int = 5) -> List[Dict]:
        """获取热门功能"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            results = conn.execute("""
                SELECT 
                    feature,
                    COUNT(*) as usage_count,
                    AVG(CASE WHEN processing_time IS NOT NULL THEN processing_time END) as avg_time,
                    SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
                FROM usage_events 
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY feature
                ORDER BY usage_count DESC
                LIMIT ?
            """, (limit,)).fetchall()
            
            return [dict(row) for row in results]
    
    def cleanup_old_data(self, days: int = 90):
        """清理旧数据"""
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            deleted = conn.execute(
                "DELETE FROM usage_events WHERE timestamp < ?",
                (cutoff_date,)
            ).rowcount
            
            return deleted

# 全局分析管理器
analytics_manager = AnalyticsManager()

# 使用统计装饰器
def track_usage(feature: str, action: str = "execute"):
    """使用统计装饰器"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            start_time = datetime.now()
            success = True
            error_message = None
            file_type = None
            file_size = None
            
            try:
                # 尝试从参数中提取文件信息
                for arg in args:
                    if hasattr(arg, 'filename') and hasattr(arg, 'size'):
                        file_type = Path(arg.filename).suffix.lower() if arg.filename else None
                        file_size = getattr(arg, 'size', None)
                        break
                
                result = await func(*args, **kwargs)
                return result
                
            except Exception as e:
                success = False
                error_message = str(e)
                raise
            
            finally:
                processing_time = (datetime.now() - start_time).total_seconds()
                
                event = UsageEvent(
                    timestamp=start_time.isoformat(),
                    feature=feature,
                    action=action,
                    file_type=file_type,
                    file_size=file_size,
                    processing_time=processing_time,
                    success=success,
                    error_message=error_message
                )
                
                analytics_manager.log_event(event)
        
        def sync_wrapper(*args, **kwargs):
            start_time = datetime.now()
            success = True
            error_message = None
            file_type = None
            file_size = None
            
            try:
                # 尝试从参数中提取文件信息
                for arg in args:
                    if hasattr(arg, 'filename') and hasattr(arg, 'size'):
                        file_type = Path(arg.filename).suffix.lower() if arg.filename else None
                        file_size = getattr(arg, 'size', None)
                        break
                
                result = func(*args, **kwargs)
                return result
                
            except Exception as e:
                success = False
                error_message = str(e)
                raise
            
            finally:
                processing_time = (datetime.now() - start_time).total_seconds()
                
                event = UsageEvent(
                    timestamp=start_time.isoformat(),
                    feature=feature,
                    action=action,
                    file_type=file_type,
                    file_size=file_size,
                    processing_time=processing_time,
                    success=success,
                    error_message=error_message
                )
                
                analytics_manager.log_event(event)
        
        import asyncio
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator