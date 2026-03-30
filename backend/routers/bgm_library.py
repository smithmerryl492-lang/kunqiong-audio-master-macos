"""
BGM库路由 - 纯本地模式
用户将BGM文件放到 backend/bgm 文件夹即可使用
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import os
import subprocess
import sys
from pathlib import Path
from .resource_path import get_bgm_dir

router = APIRouter(prefix="/api/bgm", tags=["bgm"])

# BGM文件夹路径
BGM_DIR = get_bgm_dir()


# 预设分类
CATEGORIES = ['轻音乐', '古典', '电子', '氛围', '流行']

@router.get("/list")
async def list_local_bgms():
    """
    获取本地BGM文件列表（支持分类）
    文件放在 bgm/分类名/ 下会自动归类
    """
    # 确保目录存在
    if not BGM_DIR.exists():
        BGM_DIR.mkdir(parents=True, exist_ok=True)
        for cat in CATEGORIES:
            (BGM_DIR / cat).mkdir(exist_ok=True)
        return {"bgms": [], "categories": CATEGORIES}
    
    bgms = []
    audio_extensions = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'}
    
    # 扫描分类子文件夹
    for cat in CATEGORIES:
        cat_dir = BGM_DIR / cat
        if cat_dir.exists() and cat_dir.is_dir():
            for file in cat_dir.iterdir():
                if file.is_file() and file.suffix.lower() in audio_extensions:
                    bgms.append({
                        "id": f"{cat}_{file.name}",
                        "name": file.stem,
                        "category": cat,
                        "filename": file.name,
                        "path": f"{cat}/{file.name}"
                    })
    
    # 扫描根目录（归类为"其他"）
    for file in BGM_DIR.iterdir():
        if file.is_file() and file.suffix.lower() in audio_extensions:
            bgms.append({
                "id": f"其他_{file.name}",
                "name": file.stem,
                "category": "其他",
                "filename": file.name,
                "path": file.name
            })
    
    # 按分类和名称排序
    bgms.sort(key=lambda x: (CATEGORIES.index(x['category']) if x['category'] in CATEGORIES else 999, x['name']))
    
    return {"bgms": bgms, "categories": CATEGORIES + (['其他'] if any(b['category'] == '其他' for b in bgms) else [])}


@router.get("/local/{path:path}")
async def get_local_bgm(path: str):
    """获取本地BGM文件（支持分类路径）"""
    file_path = BGM_DIR / path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 根据扩展名设置正确的 MIME 类型
    ext = file_path.suffix.lower()
    mime_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.aac': 'audio/aac',
        '.wma': 'audio/x-ms-wma'
    }
    media_type = mime_types.get(ext, 'audio/mpeg')
    
    return FileResponse(file_path, filename=file_path.name, media_type=media_type)


@router.post("/open-folder")
async def open_bgm_folder():
    """打开BGM文件夹（方便用户添加音乐）"""
    # 确保目录存在
    if not BGM_DIR.exists():
        BGM_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        # Windows
        if sys.platform == 'win32':
            os.startfile(str(BGM_DIR))
        # macOS
        elif sys.platform == 'darwin':
            subprocess.run(['open', str(BGM_DIR)])
        # Linux
        else:
            subprocess.run(['xdg-open', str(BGM_DIR)])
        
        return JSONResponse({"success": True, "path": str(BGM_DIR)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"无法打开文件夹: {str(e)}")
