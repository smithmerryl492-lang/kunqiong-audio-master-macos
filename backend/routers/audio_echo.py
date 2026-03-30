"""
音频回声效果路由
使用 FFmpeg aecho 滤镜
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
async def echo_audio(
    file: UploadFile = File(...),
    delay: int = Form(500),  # 延迟时间（毫秒）
    decay: float = Form(0.5),  # 衰减系数 0-1
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    添加回声效果
    
    参数:
    - file: 音频文件
    - delay: 延迟时间（毫秒）
    - decay: 衰减系数 (0-1)
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if delay < 10 or delay > 5000:
        raise HTTPException(status_code=400, detail="延迟时间必须在 10-5000 毫秒之间")
    if decay < 0 or decay > 1:
        raise HTTPException(status_code=400, detail="衰减系数必须在 0-1 之间")
    
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
        
        # aecho=in_gain:out_gain:delays:decays
        filter_str = f"aecho=0.8:0.9:{delay}:{decay}"
        
        cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "回声效果添加成功",
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
async def batch_echo_audio(
    files: List[UploadFile] = File(...),
    delay: int = Form(500),
    decay: float = Form(0.5),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量添加回声效果"""
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
            
            filter_str = f"aecho=0.8:0.9:{delay}:{decay}"
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
