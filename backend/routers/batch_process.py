"""
批量处理路由
支持多文件批量处理，统一参数应用
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import os
import uuid
import subprocess
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from .utils import get_unique_filename, decode_filename, prepare_output_directory
from .config import UPLOAD_DIR, OUTPUT_DIR

router = APIRouter()

# 线程池用于并行处理
executor = ThreadPoolExecutor(max_workers=4)


@router.post("/convert")
async def batch_convert(
    files: List[UploadFile] = File(...),
    output_format: str = Form("mp3"),
    bitrate: int = Form(256),
    channels: str = Form("original"),
    encoding: str = Form("vbr"),
    sample_rate: str = Form("auto"),
    output_path: str = Form(""),
    # 批量元数据（可选）
    apply_metadata: bool = Form(False),
    meta_title_template: str = Form(""),  # 支持 {filename} 占位符
    meta_artist: str = Form(""),
    meta_album: str = Form(""),
    meta_year: str = Form(""),
    meta_genre: str = Form("")
):
    """
    批量音频转换
    支持统一参数应用到所有文件
    """
    results = []
    save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
    
    for idx, file in enumerate(files):
        file_id = str(uuid.uuid4())
        input_ext = os.path.splitext(file.filename)[1] if file.filename else ".tmp"
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
        
        try:
            # 保存上传文件
            with open(input_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # 确定输出文件名
            original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else f"output_{idx+1}"
            output_filename = f"{original_name}.{output_format}"
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output_path = os.path.join(save_dir, output_filename)
            
            # Windows 路径处理
            if os.name == 'nt':
                final_output_path = final_output_path.replace('/', '\\')
                input_path = os.path.abspath(input_path).replace('/', '\\')
            
            # 构建 FFmpeg 命令
            cmd = ["ffmpeg", "-i", input_path]
            
            # 声道设置
            if channels == "mono":
                cmd.extend(["-ac", "1"])
            elif channels == "stereo":
                cmd.extend(["-ac", "2"])
            
            # 采样率设置
            if sample_rate != "auto":
                cmd.extend(["-ar", sample_rate])
            
            # 比特率和编码设置
            if output_format in ["mp3", "aac", "ogg", "wma", "m4a", "ac3", "mp2"]:
                if encoding == "cbr":
                    cmd.extend(["-b:a", f"{bitrate}k"])
                else:  # vbr
                    vbr_quality = max(0, min(9, 9 - (bitrate - 32) // 32))
                    if output_format == "mp3":
                        cmd.extend(["-q:a", str(vbr_quality)])
                    else:
                        cmd.extend(["-b:a", f"{bitrate}k"])
            
            # 元数据设置
            if apply_metadata:
                if meta_title_template:
                    title = meta_title_template.replace("{filename}", original_name)
                    cmd.extend(["-metadata", f"title={title}"])
                if meta_artist:
                    cmd.extend(["-metadata", f"artist={meta_artist}"])
                if meta_album:
                    cmd.extend(["-metadata", f"album={meta_album}"])
                if meta_year:
                    cmd.extend(["-metadata", f"date={meta_year}"])
                if meta_genre:
                    cmd.extend(["-metadata", f"genre={meta_genre}"])
            
            cmd.extend(["-y", final_output_path])
            
            # 执行转换
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if result.returncode != 0:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": f"转换失败: {result.stderr[:200]}"
                })
            else:
                output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output_path,
                    "output_filename": output_filename,
                    "size": output_size
                })
            
            # 清理上传文件
            if os.path.exists(input_path):
                os.remove(input_path)
                
        except Exception as e:
            if os.path.exists(input_path):
                try:
                    os.remove(input_path)
                except:
                    pass
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    success_count = sum(1 for r in results if r.get("success", False))
    
    return {
        "success": success_count > 0,
        "total": len(files),
        "success_count": success_count,
        "failed_count": len(files) - success_count,
        "message": f"完成 {success_count}/{len(files)} 个文件",
        "results": results,
        "is_fallback": is_fallback,
        "output_directory": save_dir
    }


@router.post("/preset/apply")
async def apply_preset(
    files: List[UploadFile] = File(...),
    preset_config: str = Form(...)  # JSON 字符串
):
    """
    应用预设配置到批量文件
    preset_config 格式:
    {
        "output_format": "mp3",
        "bitrate": 256,
        "channels": "stereo",
        "encoding": "vbr",
        "sample_rate": "44100",
        "metadata": {...}
    }
    """
    try:
        config = json.loads(preset_config)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="预设配置格式错误")
    
    # 调用批量转换，使用预设参数
    return await batch_convert(
        files=files,
        output_format=config.get("output_format", "mp3"),
        bitrate=config.get("bitrate", 256),
        channels=config.get("channels", "original"),
        encoding=config.get("encoding", "vbr"),
        sample_rate=config.get("sample_rate", "auto"),
        output_path=config.get("output_path", ""),
        apply_metadata=config.get("apply_metadata", False),
        meta_title_template=config.get("metadata", {}).get("title_template", ""),
        meta_artist=config.get("metadata", {}).get("artist", ""),
        meta_album=config.get("metadata", {}).get("album", ""),
        meta_year=config.get("metadata", {}).get("year", ""),
        meta_genre=config.get("metadata", {}).get("genre", "")
    )


@router.get("/queue/status")
async def get_queue_status():
    """
    获取批量处理队列状态
    """
    # 这里可以实现更复杂的队列管理
    return {
        "active_tasks": 0,
        "pending_tasks": 0,
        "completed_tasks": 0
    }
