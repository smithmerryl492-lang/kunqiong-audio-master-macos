from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
import subprocess
from typing import Optional
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/")
async def cut_audio(
    file: UploadFile = File(...),
    start_time: float = Form(0),
    end_time: float = Form(-1),
    output_format: str = Form(""),  # 空字符串表示保持原格式
    output_path: str = Form("")
):
    """
    音频剪切
    - file: 音频文件
    - start_time: 开始时间（秒）
    - end_time: 结束时间（秒），-1表示到结尾
    - output_format: 输出格式，空表示保持原格式
    - output_path: 输出目录
    """
    file_id = str(uuid.uuid4())
    input_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
    
    # 保存上传文件
    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
        
        # 确定输出格式
        if output_format and output_format != "原文件格式":
            out_ext = f".{output_format.lower()}"
        else:
            out_ext = input_ext
        
        # 使用原文件名
        output_filename = f"{original_name}{out_ext}"
        
        # 准备输出目录（自动处理权限问题和回退）
        save_dir, is_fallback = prepare_output_directory(
            output_path if (output_path and os.path.isdir(output_path)) else "",
            OUTPUT_DIR
        )
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output_path = os.path.join(save_dir, output_filename)
        
        # 构建 FFmpeg 命令
        cmd = ["ffmpeg"]
        
        # 剪切设置 - -ss 放在 -i 之前实现精确定位
        if start_time > 0:
            cmd.extend(["-ss", str(start_time)])
        
        cmd.extend(["-i", input_path])
        
        # 使用 -t 指定持续时间（而不是 -to 指定结束时间）
        if end_time > 0 and end_time > start_time:
            duration = end_time - start_time
            cmd.extend(["-t", str(duration)])
        
        # 如果保持原格式，使用流复制（更快）
        if out_ext == input_ext:
            cmd.extend(["-c", "copy"])
        else:
            # 转换格式时需要重新编码
            if out_ext.lower() in ['.mp3']:
                cmd.extend(["-acodec", "libmp3lame", "-q:a", "2"])
            elif out_ext.lower() in ['.aac', '.m4a']:
                cmd.extend(["-acodec", "aac", "-b:a", "192k"])
            elif out_ext.lower() in ['.wav']:
                cmd.extend(["-acodec", "pcm_s16le"])
            elif out_ext.lower() in ['.flac']:
                cmd.extend(["-acodec", "flac"])
            elif out_ext.lower() in ['.ogg']:
                cmd.extend(["-acodec", "libvorbis", "-q:a", "5"])
        
        cmd.extend(["-y", final_output_path])
        
        # 执行剪切
        print(f"执行命令: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            print(f"FFmpeg 错误: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"剪切失败: {result.stderr}")
        
        # 获取输出文件大小
        output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
        
        # 清理上传文件
        if os.path.exists(input_path):
            os.remove(input_path)
        
        return {
            "success": True,
            "message": "剪切成功" if not is_fallback else "由于目录权限限制，文件已保存到临时目录",
            "output_path": final_output_path,
            "filename": output_filename,
            "size": output_size,
            "is_fallback": is_fallback
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # 清理文件
        if os.path.exists(input_path):
            os.remove(input_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def batch_cut_audio(
    files: list[UploadFile] = File(...),
    start_times: str = Form(""),  # JSON 数组字符串
    end_times: str = Form(""),    # JSON 数组字符串
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    批量音频剪切
    """
    import json
    
    try:
        start_list = json.loads(start_times) if start_times else []
        end_list = json.loads(end_times) if end_times else []
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="时间参数格式错误")
    
    results = []
    
    for i, file in enumerate(files):
        start_time = start_list[i] if i < len(start_list) else 0
        end_time = end_list[i] if i < len(end_list) else -1
        
        file_id = str(uuid.uuid4())
        input_ext = os.path.splitext(file.filename)[1] if file.filename else ".mp3"
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{input_ext}")
        
        # 保存上传文件
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        try:
            original_name = os.path.splitext(decode_filename(file.filename))[0] if file.filename else "output"
            
            if output_format and output_format != "原文件格式":
                out_ext = f".{output_format.lower()}"
            else:
                out_ext = input_ext
            
            # 使用原文件名
            output_filename = f"{original_name}{out_ext}"
            
            save_dir = output_path if (output_path and os.path.isdir(output_path)) else OUTPUT_DIR
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output_path = os.path.join(save_dir, output_filename)
            
            cmd = ["ffmpeg"]
            
            if start_time > 0:
                cmd.extend(["-ss", str(start_time)])
            
            cmd.extend(["-i", input_path])
            
            if end_time > 0 and end_time > start_time:
                duration = end_time - start_time
                cmd.extend(["-t", str(duration)])
            
            if out_ext == input_ext:
                cmd.extend(["-c", "copy"])
            else:
                if out_ext.lower() in ['.mp3']:
                    cmd.extend(["-acodec", "libmp3lame", "-q:a", "2"])
                elif out_ext.lower() in ['.aac', '.m4a']:
                    cmd.extend(["-acodec", "aac", "-b:a", "192k"])
                elif out_ext.lower() in ['.wav']:
                    cmd.extend(["-acodec", "pcm_s16le"])
                elif out_ext.lower() in ['.flac']:
                    cmd.extend(["-acodec", "flac"])
                elif out_ext.lower() in ['.ogg']:
                    cmd.extend(["-acodec", "libvorbis", "-q:a", "5"])
            
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
                    "message": f"剪切失败: {result.stderr}"
                })
            else:
                output_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else 0
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "message": "剪切成功",
                    "output_path": final_output_path,
                    "output_filename": output_filename,
                    "size": output_size
                })
            
            # 清理上传文件
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


@router.get("/info")
async def get_audio_info(file_path: str):
    """
    获取音频文件信息
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="获取音频信息失败")
        
        import json
        info = json.loads(result.stdout)
        
        return {
            "success": True,
            "info": info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
