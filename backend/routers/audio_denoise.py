"""
音频降噪路由
使用 FFmpeg anlmdn/highpass/lowpass 滤镜
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
async def denoise_audio(
    file: UploadFile = File(...),
    strength: float = Form(0.5),  # 降噪强度 0.0-1.0
    highpass: int = Form(0),  # 高通滤波频率 (Hz)，0表示不启用
    lowpass: int = Form(0),  # 低通滤波频率 (Hz)，0表示不启用
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    音频降噪
    
    参数:
    - file: 音频文件
    - strength: 降噪强度 (0.0-1.0)
    - highpass: 高通滤波频率，去除低于此频率的噪音
    - lowpass: 低通滤波频率，去除高于此频率的噪音
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if strength < 0 or strength > 1:
        raise HTTPException(status_code=400, detail="降噪强度必须在 0-1 之间")
    
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
        
        # 构建滤镜链
        filters = []
        
        # 使用 afftdn 滤镜进行降噪（比 anlmdn 更稳定兼容）
        # nr: 降噪量 (dB), nf: 噪声底限
        noise_reduction = 10 + strength * 30  # 10-40 dB
        filters.append(f"afftdn=nr={noise_reduction}:nf=-25")
        
        # 高通滤波（去除低频噪音如嗡嗡声）
        if highpass > 0:
            filters.append(f"highpass=f={highpass}")
        
        # 低通滤波（去除高频噪音如嘶嘶声）
        if lowpass > 0:
            filters.append(f"lowpass=f={lowpass}")
        
        filter_str = ",".join(filters)
        
        cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"降噪失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "降噪成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"降噪失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/batch")
async def batch_denoise_audio(
    files: List[UploadFile] = File(...),
    strength: float = Form(0.5),
    highpass: int = Form(0),
    lowpass: int = Form(0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量音频降噪"""
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
            
            filters = []
            noise_reduction = 10 + strength * 30
            filters.append(f"afftdn=nr={noise_reduction}:nf=-25")
            if highpass > 0:
                filters.append(f"highpass=f={highpass}")
            if lowpass > 0:
                filters.append(f"lowpass=f={lowpass}")
            filter_str = ",".join(filters)
            
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
