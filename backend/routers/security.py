"""
安全检查和输入验证
"""
import os
import mimetypes
from pathlib import Path
from typing import List, Optional
import hashlib
import magic
from fastapi import HTTPException, UploadFile
from utils.i18n import t

class SecurityValidator:
    """安全验证器"""
    
    # 允许的文件类型
    ALLOWED_AUDIO_TYPES = {
        'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 
        'audio/aac', 'audio/ogg', 'audio/webm', 'audio/m4a',
        'audio/x-m4a', 'audio/mp4', 'audio/3gpp', 'audio/amr'
    }
    
    ALLOWED_IMAGE_TYPES = {
        'image/jpeg', 'image/png', 'image/bmp', 'image/gif', 
        'image/webp', 'image/tiff'
    }
    
    ALLOWED_DOCUMENT_TYPES = {
        'text/plain', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf'
    }
    
    # 危险文件扩展名
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', 
        '.js', '.jar', '.ps1', '.sh', '.php', '.asp', '.jsp'
    }
    
    def __init__(self, max_file_size: int = 100 * 1024 * 1024):  # 100MB
        self.max_file_size = max_file_size
    
    async def validate_audio_file(self, file: UploadFile) -> bool:
        """验证音频文件"""
        return await self._validate_file(file, self.ALLOWED_AUDIO_TYPES, t("types.audio"))
    
    async def validate_image_file(self, file: UploadFile) -> bool:
        """验证图片文件"""
        return await self._validate_file(file, self.ALLOWED_IMAGE_TYPES, t("types.image"))
    
    async def validate_document_file(self, file: UploadFile) -> bool:
        """验证文档文件"""
        return await self._validate_file(file, self.ALLOWED_DOCUMENT_TYPES, t("types.document"))
    
    async def _validate_file(self, file: UploadFile, allowed_types: set, file_type_name: str) -> bool:
        """通用文件验证"""
        if not file.filename:
            raise HTTPException(status_code=400, detail=t("errors.empty_filename"))
        
        # 检查文件扩展名
        file_ext = Path(file.filename).suffix.lower()
        if file_ext in self.DANGEROUS_EXTENSIONS:
            raise HTTPException(status_code=400, detail=t("errors.disallowed_file_type", ext=file_ext))
        
        # 检查文件大小
        content = await file.read()
        await file.seek(0)  # 重置文件指针
        
        if len(content) > self.max_file_size:
            raise HTTPException(
                status_code=400, 
                detail=t("errors.file_size_exceeded", size=self.max_file_size // 1024 // 1024)
            )
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail=t("errors.empty_file"))
        
        # 检查MIME类型
        try:
            # 使用python-magic检查真实文件类型
            mime_type = magic.from_buffer(content, mime=True)
            if mime_type not in allowed_types:
                # 备用检查：使用文件扩展名
                guessed_type, _ = mimetypes.guess_type(file.filename)
                if guessed_type not in allowed_types:
                    raise HTTPException(
                        status_code=400, 
                        detail=t("errors.unsupported_file_format", type=file_type_name, mime=mime_type)
                    )
        except Exception:
            # 如果magic检查失败，使用扩展名检查
            guessed_type, _ = mimetypes.guess_type(file.filename)
            if guessed_type not in allowed_types:
                raise HTTPException(
                    status_code=400, 
                    detail=t("errors.unrecognized_file_format", type=file_type_name)
                )
        
        return True
    
    def validate_text_input(self, text: str, max_length: int = 10000, field_name: str = "文本") -> bool:
        """验证文本输入"""
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail=t("errors.field_required", field=field_name))
        
        if len(text) > max_length:
            raise HTTPException(
                status_code=400, 
                detail=t("errors.field_too_long", field=field_name, max=max_length)
            )
        
        # 检查恶意内容
        dangerous_patterns = ['<script', 'javascript:', 'vbscript:', 'onload=', 'onerror=']
        text_lower = text.lower()
        for pattern in dangerous_patterns:
            if pattern in text_lower:
                raise HTTPException(status_code=400, detail=t("errors.unsafe_content", field=field_name))
        
        return True
    
    def validate_path(self, path: str) -> bool:
        """验证路径安全性"""
        if not path:
            return True
        
        # 检查路径遍历攻击
        if '..' in path or path.startswith('/') or ':' in path:
            raise HTTPException(status_code=400, detail=t("errors.unsafe_path"))
        
        return True
    
    def generate_safe_filename(self, original_filename: str) -> str:
        """生成安全的文件名"""
        if not original_filename:
            return "unnamed_file"
        
        # 移除危险字符
        safe_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"
        filename = "".join(c for c in original_filename if c in safe_chars)
        
        # 确保不为空
        if not filename:
            filename = "safe_file"
        
        # 限制长度
        if len(filename) > 100:
            name, ext = os.path.splitext(filename)
            filename = name[:90] + ext
        
        return filename
    
    def calculate_file_hash(self, content: bytes) -> str:
        """计算文件哈希值"""
        return hashlib.sha256(content).hexdigest()

# 全局安全验证器
security_validator = SecurityValidator()

# 安全验证装饰器
def validate_audio_upload(func):
    """音频文件上传验证装饰器"""
    async def wrapper(*args, **kwargs):
        # 查找UploadFile参数
        for arg in args:
            if isinstance(arg, UploadFile):
                await security_validator.validate_audio_file(arg)
                break
        
        for key, value in kwargs.items():
            if isinstance(value, UploadFile):
                await security_validator.validate_audio_file(value)
        
        return await func(*args, **kwargs)
    return wrapper