from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import os
import uuid
import subprocess
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR

# 支持的音频输出格�?
AUDIO_FORMATS = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "ac3"]


@router.post("/")
async def extract_audio(
    file: UploadFile = File(...),
    output_format: str = Form("mp3"),
    output_path: str = Form(""),
    bitrate: int = Form(192)
):
    """
    从视频中提取音频
    - file: 视频文件
    - output_format: 输出音频格式
    - output_path: 输出目录
    - bitrate: 音频比特�?
    """
    output_format = output_format.lower()
    if output_format not in AUDIO_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的输出格式: {output_format}")
    
    file_id = str(uuid.uuid4())
    input_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
    
    # 保存上传文件
    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        # 使用原文件名
        original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
        output_filename = f"{original_name}.{output_format}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(

        
            output_path if (output_path and os.path.isdir(output_path)) else "",

        
            OUTPUT_DIR

        
        )
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output_path = os.path.join(save_dir, output_filename)

        # 构建 FFmpeg 命令
        cmd = ["ffmpeg", "-i", input_path, "-vn"]  # -vn 表示不处理视�?
        
        # 根据输出格式设置编码�?
        if output_format == "mp3":
            cmd.extend(["-acodec", "libmp3lame", "-b:a", f"{bitrate}k"])
        elif output_format == "aac":
            cmd.extend(["-acodec", "aac", "-b:a", f"{bitrate}k"])
        elif output_format == "wav":
            cmd.extend(["-acodec", "pcm_s16le"])
        elif output_format == "flac":
            cmd.extend(["-acodec", "flac"])
        elif output_format == "ogg":
            cmd.extend(["-acodec", "libvorbis", "-b:a", f"{bitrate}k"])
        elif output_format == "m4a":
            cmd.extend(["-acodec", "aac", "-b:a", f"{bitrate}k"])
        elif output_format == "wma":
            cmd.extend(["-acodec", "wmav2", "-b:a", f"{bitrate}k"])
        elif output_format == "ac3":
            cmd.extend(["-acodec", "ac3", "-b:a", f"{bitrate}k"])
        
        cmd.extend(["-y", final_output_path])
        
        # 执行提取
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"提取失败: {result.stderr}")
        
        # 获取输出文件大小
        output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
        
        # 清理上传文件
        if os.path.exists(input_path):
            os.remove(input_path)
        
        return {
            "success": True,
            "message": "提取成功",
            "output_path": final_output_path,
            "filename": output_filename,
            "size": output_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(input_path):
            os.remove(input_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def batch_extract_audio(
    files: list[UploadFile] = File(...),
    output_format: str = Form("mp3"),
    output_path: str = Form(""),
    bitrate: int = Form(192)
):
    """批量从视频中提取音频"""
    results = []
    
    for file in files:
        file_id = str(uuid.uuid4())
        input_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
        
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        try:
            # 使用原文件名
            original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
            output_filename = f"{original_name}.{output_format}"
            
            # 准备输出目录

            
            save_dir, is_fallback = prepare_output_directory(

            
                output_path if (output_path and os.path.isdir(output_path)) else "",

            
                OUTPUT_DIR

            
            )
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output_path = os.path.join(save_dir, output_filename)
            
            cmd = ["ffmpeg", "-i", input_path, "-vn"]
            
            if output_format == "mp3":
                cmd.extend(["-acodec", "libmp3lame", "-b:a", f"{bitrate}k"])
            elif output_format == "aac":
                cmd.extend(["-acodec", "aac", "-b:a", f"{bitrate}k"])
            elif output_format == "wav":
                cmd.extend(["-acodec", "pcm_s16le"])
            elif output_format == "flac":
                cmd.extend(["-acodec", "flac"])
            elif output_format == "ogg":
                cmd.extend(["-acodec", "libvorbis", "-b:a", f"{bitrate}k"])
            elif output_format == "m4a":
                cmd.extend(["-acodec", "aac", "-b:a", f"{bitrate}k"])
            
            cmd.extend(["-y", final_output_path])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            if result.returncode != 0:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": f"提取失败: {result.stderr}"
                })
            else:
                output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "message": "提取成功",
                    "output_path": final_output_path,
                    "output_filename": output_filename,
                    "size": output_size
                })
            
            if os.path.exists(input_path):
                os.remove(input_path)
                
        except Exception as e:
            if os.path.exists(input_path):
                os.remove(input_path)
            results.append({
                "filename": file.filename,
                "success": False,
                "message": str(e)
            })
    
    success_count = sum(1 for r in results if r["success"])
    
    return {
        "success": success_count == len(results),
        "message": f"完成 {success_count}/{len(results)} 个文件",
        "results": results
    }


@router.get("/formats")
async def get_supported_formats():
    """获取支持的音频输出格式"""
    return {"formats": AUDIO_FORMATS}
