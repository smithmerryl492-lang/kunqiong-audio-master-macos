from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
import subprocess
import json
from pathlib import Path
from .utils import get_unique_filename, decode_filename, prepare_output_directory
from utils.i18n import t

router = APIRouter()

# 支持的输出格式
SUPPORTED_FORMATS = [
    "mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "ac3",
    "m4r", "amr", "caf", "aiff", "pcm", "au", "mp2", "wv"
]

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/")
async def convert_audio(
    file: UploadFile = File(...),
    output_format: str = Form("mp3"),
    bitrate: int = Form(256),
    channels: str = Form("original"),  # original, mono, stereo
    encoding: str = Form("vbr"),  # vbr, cbr
    sample_rate: str = Form("auto"),  # auto 或具体数值如 44100
    output_path: str = Form(""),  # 用户指定的输出路径
    start_time: float = Form(0),  # 剪切开始时间（秒）
    end_time: float = Form(-1),  # 剪切结束时间（秒），-1表示到结尾
    # 元数据
    meta_title: str = Form(""),
    meta_artist: str = Form(""),
    meta_album: str = Form(""),
    meta_year: str = Form(""),
    meta_genre: str = Form("")
):
    """
    音频格式转换（支持剪切和元数据修改）
    """
    print(f"收到转换请求: {file.filename}, 格式: {output_format}")
    
    input_path = ""
    try:
        # 验证格式
        output_format = output_format.lower()
        if output_format not in SUPPORTED_FORMATS:
            raise HTTPException(status_code=400, detail=t("errors.unsupported_format", format=output_format))
        
        # 保存上传文件
        file_id = str(uuid.uuid4())
        input_ext = os.path.splitext(file.filename)[1] if file.filename else ".tmp"
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
        
        print(f"正在保存上传文件到: {input_path}")
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 确定输出文件路径
        original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
        output_filename = f"{original_name}.{output_format}"
        
        # 准备输出目录（自动处理权限问题和回退）
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output_path = os.path.join(save_dir, output_filename)
        
        # Windows 环境下，FFmpeg 对反斜杠的支持更好
        if os.name == 'nt':
            final_output_path = final_output_path.replace('/', '\\')
            input_path = os.path.abspath(input_path).replace('/', '\\')
        
        # 移除回退机制，直接调用 FFmpeg
        cmd = ["ffmpeg", "-i", input_path]
        
        # 剪切设置
        if start_time > 0:
            cmd.extend(["-ss", str(start_time)])
        if end_time > 0:
            cmd.extend(["-to", str(end_time)])
        
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
        if meta_title:
            cmd.extend(["-metadata", f"title={meta_title}"])
        if meta_artist:
            cmd.extend(["-metadata", f"artist={meta_artist}"])
        if meta_album:
            cmd.extend(["-metadata", f"album={meta_album}"])
        if meta_year:
            cmd.extend(["-metadata", f"date={meta_year}"])
        if meta_genre:
            cmd.extend(["-metadata", f"genre={meta_genre}"])
        
        # 特殊格式处理
        if output_format == "m4r":
            cmd.extend(["-f", "ipod"])
        elif output_format == "pcm":
            cmd.extend(["-f", "s16le", "-acodec", "pcm_s16le"])
        elif output_format == "au":
            cmd.extend(["-f", "au"])
        elif output_format == "caf":
            cmd.extend(["-f", "caf"])
        
        cmd.extend(["-y", final_output_path])
        
        # 执行转换
        print(f"最终输出路径: {final_output_path!r}")
        print(f"执行 FFmpeg 命令: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True,
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            print(f"FFmpeg 转换失败, 错误输出: {result.stderr}")
            raise HTTPException(status_code=500, detail=t("errors.convert_failed", error=result.stderr))
        
        # 获取输出文件大小
        output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
        
        # 清理上传文件
        if input_path and os.path.exists(input_path):
            os.remove(input_path)
        
        return {
            "success": True,
            "message": t("messages.convert_success") if not is_fallback else t("messages.fallback_save_msg"),
            "output_path": final_output_path,
            "filename": output_filename,
            "size": output_size,
            "is_fallback": is_fallback
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"转换请求处理发生异常: {str(e)}")
        import traceback
        traceback.print_exc()
        # 清理文件
        if input_path and os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cut")
async def cut_audio(
    file: UploadFile = File(...),
    start_time: float = Form(0),
    end_time: float = Form(-1),
    output_path: str = Form("")
):
    """
    音频剪切（保持原格式）
    """
    file_id = str(uuid.uuid4())
    input_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
    
    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
        output_filename = f"{original_name}{input_ext}"
        
        # 准备输出目录（自动处理权限问题和回退）
        save_dir, is_fallback = prepare_output_directory(
            output_path if (output_path and os.path.isdir(output_path)) else "",
            OUTPUT_DIR
        )
        
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output_path = os.path.join(save_dir, output_filename)
        
        cmd = ["ffmpeg", "-i", input_path]
        
        if start_time > 0:
            cmd.extend(["-ss", str(start_time)])
        if end_time > 0:
            cmd.extend(["-to", str(end_time)])
        
        cmd.extend(["-c", "copy", "-y", final_output_path])
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=t("errors.cut_failed", error=result.stderr))
        
        if os.path.exists(input_path):
            os.remove(input_path)
        
        return {
            "success": True,
            "message": t("messages.cut_success") if not is_fallback else t("messages.fallback_save_msg"),
            "output_path": final_output_path,
            "filename": output_filename,
            "is_fallback": is_fallback
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(input_path):
            os.remove(input_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{file_id}")
async def download_file(file_id: str, format: str = "mp3"):
    """下载转换后的文件"""
    file_path = os.path.join(OUTPUT_DIR, f"{file_id}.{format}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=t("errors.file_not_found"))
    return FileResponse(file_path)


@router.get("/formats")
async def get_supported_formats():
    """获取支持的格式列表"""
    return {"formats": SUPPORTED_FORMATS}
