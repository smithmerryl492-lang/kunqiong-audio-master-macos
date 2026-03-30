"""
视频消除人声路由
从视频中提取音频，消除人声后替换回视�?
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
from typing import List
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


def get_video_duration(file_path: str) -> float:
    """获取视频时长"""
    cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        return float(result.stdout.strip())
    except:
        return 0


@router.post("/")
async def remove_vocal_from_video(
    file: UploadFile = File(...),
    output_path: str = Form("")
):
    """
    视频消除人声
    
    原理�?
    1. 从视频提取音�?
    2. 使用相位抵消消除人声（中心声道消除）
    3. 将处理后的音频替换回视频
    """
    # 验证文件类型
    file_ext = os.path.splitext(file.filename)[1].lower()
    video_exts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
    if file_ext not in video_exts:
        raise HTTPException(status_code=400, detail="请上传视频文件")
    
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        # 保存上传文件
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取视频时长
        duration = get_video_duration(input_path)
        
        # 使用原文件名（解码中文文件名�?
        output_filename = decode_filename(file.filename)
        
        # 确定输出路径
        # 准备输出目录

        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(os.path.dirname(final_output) if os.path.dirname(final_output) else OUTPUT_DIR, exist_ok=True)
        
        # 使用 FFmpeg 一步完成：提取音频、消除人声、替换回视频
        # pan=stereo|c0=c0-c1|c1=c1-c0 实现中心声道消除
        cmd = [
            'ffmpeg', '-y',
            '-i', input_path,
            '-filter_complex', '[0:a]pan=stereo|c0=c0-c1|c1=c1-c0[a]',
            '-map', '0:v',  # 保留原视频流
            '-map', '[a]',  # 使用处理后的音频
            '-c:v', 'copy',  # 视频直接复制，不重新编码
            '-c:a', 'aac',  # 音频编码�?AAC
            '-b:a', '192k',
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            # 如果失败，可能是音频是单声道，尝试直接复�?
            raise HTTPException(status_code=500, detail="消除人声失败，请确保视频音频是立体声格式")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "消除人声成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size,
            "duration": duration,
            "note": "使用中心声道消除法，效果取决于原音频的立体声混音方式"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass



@router.post("/batch")
async def batch_remove_vocal(
    files: List[UploadFile] = File(...),
    output_path: str = Form("")
):
    """批量视频消除人声"""
    results = []
    video_exts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
    
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in video_exts:
            results.append({
                "filename": file.filename,
                "success": False,
                "message": "不是视频文件"
            })
            continue
        
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
        
        try:
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            duration = get_video_duration(input_path)
            # 使用原文件名（解码中文文件名）
            output_filename = decode_filename(file.filename)
            # 准备输出目录

            save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output = os.path.join(save_dir, output_filename)
            
            os.makedirs(os.path.dirname(final_output) if os.path.dirname(final_output) else OUTPUT_DIR, exist_ok=True)
            
            cmd = [
                'ffmpeg', '-y',
                '-i', input_path,
                '-filter_complex', '[0:a]pan=stereo|c0=c0-c1|c1=c1-c0[a]',
                '-map', '0:v',
                '-map', '[a]',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                final_output
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if result.returncode == 0:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "size": os.path.getsize(final_output),
                    "duration": duration
                })
            else:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": "消除人声失败，可能音频不是立体声"
                })
                
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "message": str(e)
            })
        finally:
            if os.path.exists(input_path):
                try:
                    os.remove(input_path)
                except:
                    pass
    
    return JSONResponse({
        "success": all(r.get('success') for r in results),
        "message": f"处理完成: {sum(1 for r in results if r.get('success'))}/{len(results)} 成功",
        "results": results
    })
