"""
统一日志管理
"""
import logging
import os
from datetime import datetime
from pathlib import Path

# 创建日志目录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# 配置日志格式
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """设置日志记录器"""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if not logger.handlers:
        # 文件处理器
        log_file = LOG_DIR / f"{name}_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(level)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.WARNING)
        console_handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
    
    return logger

# 创建应用日志记录器
app_logger = setup_logger("app")
ai_logger = setup_logger("ai_processing")
error_logger = setup_logger("errors", logging.ERROR)