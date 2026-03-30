"""
缓存管理系统
"""
import os
import json
import hashlib
import pickle
from pathlib import Path
from typing import Any, Optional, Dict
from datetime import datetime, timedelta
import threading

class CacheManager:
    """缓存管理器"""
    
    def __init__(self, cache_dir: str = "cache", max_size_mb: int = 500):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.metadata_file = self.cache_dir / "metadata.json"
        self.metadata = self._load_metadata()
        self._lock = threading.Lock()
    
    def _load_metadata(self) -> Dict:
        """加载缓存元数据"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {}
    
    def _save_metadata(self):
        """保存缓存元数据"""
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False)
    
    def _get_cache_key(self, key: str) -> str:
        """生成缓存键的哈希"""
        return hashlib.md5(key.encode()).hexdigest()
    
    def _get_cache_path(self, cache_key: str) -> Path:
        """获取缓存文件路径"""
        return self.cache_dir / f"{cache_key}.cache"
    
    def set(self, key: str, value: Any, ttl_hours: int = 24):
        """设置缓存"""
        with self._lock:
            cache_key = self._get_cache_key(key)
            cache_path = self._get_cache_path(cache_key)
            
            try:
                # 序列化数据
                with open(cache_path, 'wb') as f:
                    pickle.dump(value, f)
                
                # 更新元数据
                self.metadata[cache_key] = {
                    "original_key": key,
                    "created_at": datetime.now().isoformat(),
                    "expires_at": (datetime.now() + timedelta(hours=ttl_hours)).isoformat(),
                    "size": cache_path.stat().st_size,
                    "access_count": 0,
                    "last_accessed": datetime.now().isoformat()
                }
                
                self._save_metadata()
                self._cleanup_if_needed()
                
            except Exception as e:
                print(f"Cache set error: {e}")
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        with self._lock:
            cache_key = self._get_cache_key(key)
            cache_path = self._get_cache_path(cache_key)
            
            if cache_key not in self.metadata:
                return None
            
            metadata = self.metadata[cache_key]
            
            # 检查是否过期
            expires_at = datetime.fromisoformat(metadata["expires_at"])
            if datetime.now() > expires_at:
                self._remove_cache(cache_key)
                return None
            
            try:
                # 读取数据
                with open(cache_path, 'rb') as f:
                    value = pickle.load(f)
                
                # 更新访问统计
                metadata["access_count"] += 1
                metadata["last_accessed"] = datetime.now().isoformat()
                self._save_metadata()
                
                return value
                
            except Exception as e:
                print(f"Cache get error: {e}")
                self._remove_cache(cache_key)
                return None
    
    def _remove_cache(self, cache_key: str):
        """删除缓存项"""
        cache_path = self._get_cache_path(cache_key)
        if cache_path.exists():
            cache_path.unlink()
        if cache_key in self.metadata:
            del self.metadata[cache_key]
    
    def _cleanup_if_needed(self):
        """如果需要则清理缓存"""
        total_size = sum(item.get("size", 0) for item in self.metadata.values())
        
        if total_size > self.max_size_bytes:
            # 按最后访问时间排序，删除最旧的
            items = list(self.metadata.items())
            items.sort(key=lambda x: x[1].get("last_accessed", ""))
            
            while total_size > self.max_size_bytes * 0.8 and items:
                cache_key, metadata = items.pop(0)
                total_size -= metadata.get("size", 0)
                self._remove_cache(cache_key)
    
    def clear_expired(self):
        """清理过期缓存"""
        with self._lock:
            now = datetime.now()
            expired_keys = []
            
            for cache_key, metadata in self.metadata.items():
                expires_at = datetime.fromisoformat(metadata["expires_at"])
                if now > expires_at:
                    expired_keys.append(cache_key)
            
            for cache_key in expired_keys:
                self._remove_cache(cache_key)
            
            if expired_keys:
                self._save_metadata()
    
    def get_stats(self) -> Dict:
        """获取缓存统计"""
        total_size = sum(item.get("size", 0) for item in self.metadata.values())
        total_items = len(self.metadata)
        
        return {
            "total_items": total_items,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
            "max_size_mb": round(self.max_size_bytes / 1024 / 1024, 2),
            "usage_percent": round((total_size / self.max_size_bytes) * 100, 2)
        }

# 全局缓存管理器
cache_manager = CacheManager()

# 模型缓存装饰器
def cache_result(key_prefix: str, ttl_hours: int = 24):
    """缓存结果装饰器"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{key_prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
            
            # 尝试从缓存获取
            cached_result = cache_manager.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # 执行函数并缓存结果
            result = func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl_hours)
            return result
        
        return wrapper
    return decorator