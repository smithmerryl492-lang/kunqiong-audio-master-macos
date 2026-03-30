"""
移除静音路由
使用 FFmpeg silenceremove 滤镜
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


@router.post("/")
async def remove_silence(
    file: UploadFile = File(...),
    threshold: float = Form(-50),  # 静音阈值(dB)
    min_duration: float = Form(0.5),  # 最小静音时长（秒）
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    移除音频中的静音部分
    
    参数:
    - file: 音频文件
    - threshold: 静音阈值(dB)，低于此值视为静音
    - min_duration: 最小静音时长（秒），短于此时长的静音不会被移除
    - output_format: 输出格式
    - output_path: 输出目录
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        out_ext = f".{output_format.lower()}" if output_format else file_ext
        # 使用原文件名
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # silenceremove 滤镜参数
        # stop_periods=-1: 移除所有静音段
        # stop_duration: 最小静音时长
        # stop_threshold: 静音阈值
        filter_str = f"silenceremove=stop_periods=-1:stop_duration={min_duration}:stop_threshold={threshold}dB"
        
        cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "静音移除成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
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
async def batch_remove_silence(
    files: List[UploadFile] = File(...),
    threshold: float = Form(-50),
    min_duration: float = Form(0.5),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量移除静音"""
    results = []
    
    for file in files:
        try:
            file_ext = os.path.splitext(file.filename)[1].lower()
            file_id = str(uuid.uuid4())
            input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
            
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            out_ext = f".{output_format.lower()}" if output_format else file_ext
            # 使用原文件名
            base_name = os.path.splitext(decode_filename(file.filename))[0]
            output_filename = f"{base_name}{out_ext}"
            
            # 准备输出目录

            
            save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output = os.path.join(save_dir, output_filename)
            
            os.makedirs(os.path.dirname(final_output) if os.path.dirname(final_output) else OUTPUT_DIR, exist_ok=True)
            
            filter_str = f"silenceremove=stop_periods=-1:stop_duration={min_duration}:stop_threshold={threshold}dB"
            cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if os.path.exists(input_path):
                os.remove(input_path)
            
            if result.returncode == 0:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "size": os.path.getsize(final_output)
                })
            else:
                results.append({"filename": file.filename, "success": False, "message": result.stderr})
        except Exception as e:
            results.append({"filename": file.filename, "success": False, "message": str(e)})
    
    return JSONResponse({
        "success": all(r.get('success') for r in results),
        "message": f"处理完成: {sum(1 for r in results if r.get('success'))}/{len(results)} 成功",
        "results": results
    })
