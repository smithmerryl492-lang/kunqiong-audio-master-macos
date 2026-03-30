from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
import subprocess
import json
from typing import Optional
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


def get_audio_duration(file_path: str) -> float:
    """获取音频时长（秒）"""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        encoding='utf-8',
        errors='replace',
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    try:
        return float(result.stdout.strip())
    except:
        return 0.0


@router.post("/")
async def merge_audio(
    files: list[UploadFile] = File(...),
    transition_duration: float = Form(0),
    output_format: str = Form("mp3"),
    output_path: str = Form(""),
    output_filename: str = Form("")
):
    """
    音频合并
    - files: 多个音频文件
    - transition_duration: 转场时长（秒），用于淡入淡出过渡
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="至少需要2个音频文件")
    
    merge_id = str(uuid.uuid4())
    temp_files = []
    
    try:
        # 保存所有上传文件
        for i, file in enumerate(files):
            ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
            temp_path = os.path.join(UPLOAD_DIR, f"{merge_id}_{i}{ext}")
            with open(temp_path, "wb") as f:
                content = await file.read()
                f.write(content)
            temp_files.append(temp_path)
        
        # 确定输出格式和路径
        out_ext = f".{output_format.lower()}" if output_format else ".mp3"
        # 优先使用用户指定的文件名，否则使用第一个文件的名字
        if output_filename and output_filename.strip():
            base_name = output_filename.strip()
        else:
            base_name = os.path.splitext(decode_filename(files[0].filename))[0] if files[0].filename else "merged"
        final_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录
        save_dir, is_fallback = prepare_output_directory(
            output_path if (output_path and os.path.isdir(output_path)) else "",
            OUTPUT_DIR
        )
        final_filename = get_unique_filename(save_dir, final_filename)
        final_output_path = os.path.join(save_dir, final_filename)
        
        if transition_duration > 0:
            # 带转场效果的合并（淡入淡出）
            result = await merge_with_crossfade(temp_files, final_output_path, transition_duration, out_ext)
        else:
            # 简单拼接
            result = await simple_concat(temp_files, final_output_path, out_ext)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])
        
        output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
        
        return {
            "success": True,
            "message": "合并成功",
            "output_path": final_output_path,
            "filename": final_filename,
            "size": output_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)


async def simple_concat(input_files: list[str], output_path: str, out_ext: str) -> dict:
    """简单拼接音频（无转场）"""
    merge_id = str(uuid.uuid4())
    list_file = os.path.join(UPLOAD_DIR, f"{merge_id}_list.txt")
    
    try:
        # 创建文件列表
        with open(list_file, "w", encoding="utf-8") as f:
            for file_path in input_files:
                # 使用绝对路径并转义
                abs_path = os.path.abspath(file_path).replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{abs_path}'\n")
        
        # 使用 concat demuxer
        cmd = [
            "ffmpeg", "-f", "concat", "-safe", "0",
            "-i", list_file
        ]
        
        # 根据输出格式设置编码器
        cmd.extend(get_encoder_options(out_ext))
        cmd.extend(["-y", output_path])
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            return {"success": False, "message": f"合并失败: {result.stderr}"}
        
        return {"success": True}
        
    finally:
        if os.path.exists(list_file):
            os.remove(list_file)


async def merge_with_crossfade(input_files: list[str], output_path: str, crossfade_duration: float, out_ext: str) -> dict:
    """带淡入淡出转场的音频合并"""
    if len(input_files) < 2:
        return {"success": False, "message": "至少需要2个文件"}
    
    # 获取每个文件的时长
    durations = [get_audio_duration(f) for f in input_files]
    
    # 构建复杂滤镜
    filter_parts = []
    
    # 输入标签
    for i in range(len(input_files)):
        filter_parts.append(f"[{i}:a]")
    
    # 使用 acrossfade 滤镜逐个合并
    # 第一次合并 [0] 和 [1]
    current_label = "a0"
    filter_complex = f"[0:a][1:a]acrossfade=d={crossfade_duration}:c1=tri:c2=tri[{current_label}]"
    
    # 后续文件依次合并
    for i in range(2, len(input_files)):
        next_label = f"a{i-1}"
        filter_complex += f";[{current_label}][{i}:a]acrossfade=d={crossfade_duration}:c1=tri:c2=tri[{next_label}]"
        current_label = next_label
    
    # 构建命令
    cmd = ["ffmpeg"]
    for f in input_files:
        cmd.extend(["-i", f])
    
    cmd.extend(["-filter_complex", filter_complex, "-map", f"[{current_label}]"])
    cmd.extend(get_encoder_options(out_ext))
    cmd.extend(["-y", output_path])
    
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    )
    
    if result.returncode != 0:
        return {"success": False, "message": f"合并失败: {result.stderr}"}
    
    return {"success": True}


def get_encoder_options(out_ext: str) -> list[str]:
    """根据输出格式获取编码器选项"""
    ext = out_ext.lower()
    if ext in ['.mp3']:
        return ["-acodec", "libmp3lame", "-q:a", "2"]
    elif ext in ['.aac', '.m4a']:
        return ["-acodec", "aac", "-b:a", "192k"]
    elif ext in ['.wav']:
        return ["-acodec", "pcm_s16le"]
    elif ext in ['.flac']:
        return ["-acodec", "flac"]
    elif ext in ['.ogg']:
        return ["-acodec", "libvorbis", "-q:a", "5"]
    else:
        return ["-acodec", "libmp3lame", "-q:a", "2"]


@router.get("/info")
async def get_files_info(file_paths: str):
    """
    获取多个音频文件的信息
    - file_paths: JSON数组格式的文件路径列表
    """
    try:
        paths = json.loads(file_paths)
    except:
        raise HTTPException(status_code=400, detail="文件路径格式错误")
    
    results = []
    for path in paths:
        if not os.path.exists(path):
            results.append({"path": path, "error": "文件不存在"})
            continue
        
        duration = get_audio_duration(path)
        size = os.path.getsize(path)
        
        results.append({
            "path": path,
            "filename": os.path.basename(path),
            "duration": duration,
            "size": size
        })
    
    return {"success": True, "files": results}
