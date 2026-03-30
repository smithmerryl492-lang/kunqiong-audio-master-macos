"""
应用配置管理
"""
import os
from pathlib import Path
from typing import Optional
import json

class Settings:
    """应用设置"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent
        self.config_file = self.base_dir / "config" / "app_settings.json"
        self.load_settings()
    
    def load_settings(self):
        """加载设置"""
        default_settings = {
            "ai": {
                "whisper_model": "tiny",
                "max_file_size_mb": 100,
                "supported_languages": ["zh", "en", "ja", "ko", "fr", "de", "es"],
                "default_tts_voice": "zh-CN-XiaoxiaoNeural",
                "translation_engines": ["bing", "alibaba", "baidu"]
            },
            "audio": {
                "default_sample_rate": 44100,
                "default_bitrate": 192,
                "max_duration_minutes": 60,
                "temp_cleanup_interval": 3600
            },
            "ui": {
                "theme": "dark",
                "language": "zh-CN",
                "auto_save_settings": True
            },
            "performance": {
                "max_concurrent_tasks": 3,
                "memory_limit_mb": 1024,
                "enable_gpu": False
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    user_settings = json.load(f)
                    # 合并默认设置和用户设置
                    self.settings = self._merge_settings(default_settings, user_settings)
            except Exception:
                self.settings = default_settings
        else:
            self.settings = default_settings
            self.save_settings()
    
    def _merge_settings(self, default: dict, user: dict) -> dict:
        """递归合并设置"""
        result = default.copy()
        for key, value in user.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_settings(result[key], value)
            else:
                result[key] = value
        return result
    
    def save_settings(self):
        """保存设置"""
        self.config_file.parent.mkdir(exist_ok=True)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.settings, f, indent=2, ensure_ascii=False)
    
    def get(self, key_path: str, default=None):
        """获取设置值，支持点号路径如 'ai.whisper_model'"""
        keys = key_path.split('.')
        value = self.settings
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value
    
    def set(self, key_path: str, value):
        """设置值"""
        keys = key_path.split('.')
        target = self.settings
        for key in keys[:-1]:
            if key not in target:
                target[key] = {}
            target = target[key]
        target[keys[-1]] = value
        self.save_settings()

# 全局设置实例
settings = Settings()