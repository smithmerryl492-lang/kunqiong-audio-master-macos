from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import librosa
import numpy as np
import soundfile as sf
import io
import tempfile
import os

router = APIRouter()


def analyze_basic_info(y, sr, file_size):
    """分析音频基础信息"""
    duration = librosa.get_duration(y=y, sr=sr)
    channels = 1 if len(y.shape) == 1 else y.shape[0]
    
    return {
        "duration": float(duration),
        "sample_rate": int(sr),
        "channels": channels,
        "file_size": file_size,
        "samples": len(y) if len(y.shape) == 1 else y.shape[1]
    }


def analyze_loudness(y, sr):
    """分析响度"""
    # RMS能量
    rms = librosa.feature.rms(y=y)[0]
    avg_loudness = float(np.mean(rms))
    max_loudness = float(np.max(rms))
    min_loudness = float(np.min(rms))
    
    # 转换为dB
    avg_db = float(20 * np.log10(avg_loudness + 1e-10))
    max_db = float(20 * np.log10(max_loudness + 1e-10))
    
    # 简化的LUFS估算（真实LUFS需要更复杂的计算）
    estimated_lufs = avg_db + 3.0  # 粗略估算
    
    return {
        "average_loudness": avg_loudness,
        "max_loudness": max_loudness,
        "min_loudness": min_loudness,
        "average_db": avg_db,
        "max_db": max_db,
        "estimated_lufs": estimated_lufs
    }


def analyze_dynamic_range(y):
    """分析动态范围"""
    rms = librosa.feature.rms(y=y)[0]
    max_rms = np.max(rms)
    min_rms = np.min(rms[rms > 0]) if np.any(rms > 0) else 1e-10
    
    dynamic_range_db = float(20 * np.log10(max_rms / min_rms))
    
    return {
        "dynamic_range_db": dynamic_range_db,
        "is_compressed": dynamic_range_db < 6.0  # 动态范围小于6dB认为是过度压缩
    }


def detect_clipping(y):
    """检测削波失真"""
    threshold = 0.99
    clipped_samples = np.sum(np.abs(y) >= threshold)
    total_samples = len(y) if len(y.shape) == 1 else y.shape[1]
    clipping_rate = float(clipped_samples / total_samples * 100)
    
    has_clipping = clipping_rate > 0.01  # 超过0.01%认为有削波
    
    return {
        "clipping_rate": clipping_rate,
        "has_clipping": has_clipping,
        "clipped_samples": int(clipped_samples),
        "severity": "severe" if clipping_rate > 1.0 else "moderate" if clipping_rate > 0.1 else "mild" if has_clipping else "none"
    }


def detect_silence(y, sr):
    """检测静音段"""
    # 使用librosa检测非静音区间
    intervals = librosa.effects.split(y, top_db=30)
    
    total_duration = len(y) / sr
    non_silent_duration = sum((end - start) / sr for start, end in intervals)
    silent_duration = total_duration - non_silent_duration
    silence_ratio = float(silent_duration / total_duration * 100)
    
    return {
        "silence_ratio": silence_ratio,
        "silent_duration": float(silent_duration),
        "non_silent_duration": float(non_silent_duration),
        "silence_intervals": len(intervals),
        "has_excessive_silence": silence_ratio > 20.0
    }


def analyze_spectrum(y, sr):
    """分析频谱特征"""
    # 频谱质心
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    avg_centroid = float(np.mean(spectral_centroid))
    
    # 频谱带宽
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    avg_bandwidth = float(np.mean(spectral_bandwidth))
    
    # 频谱滚降点
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    avg_rolloff = float(np.mean(spectral_rolloff))
    
    # 过零率（用于检测噪音）
    zero_crossing_rate = librosa.feature.zero_crossing_rate(y)[0]
    avg_zcr = float(np.mean(zero_crossing_rate))
    
    return {
        "spectral_centroid": avg_centroid,
        "spectral_bandwidth": avg_bandwidth,
        "spectral_rolloff": avg_rolloff,
        "zero_crossing_rate": avg_zcr,
        "is_rich_spectrum": avg_bandwidth > 2000  # 频谱丰富度
    }


def estimate_noise_level(y):
    """估算噪音水平"""
    # 使用最安静的10%样本估算噪底
    rms = librosa.feature.rms(y=y)[0]
    sorted_rms = np.sort(rms)
    noise_floor = float(np.mean(sorted_rms[:len(sorted_rms)//10]))
    noise_db = float(20 * np.log10(noise_floor + 1e-10))
    
    # 噪音评估
    has_noise = noise_db > -60  # 噪底高于-60dB认为有明显噪音
    
    return {
        "noise_floor_db": noise_db,
        "has_noise": has_noise,
        "noise_level": "high" if noise_db > -40 else "moderate" if noise_db > -50 else "low" if has_noise else "very_low"
    }


def identify_scene(basic_info, loudness, dynamic_range, spectrum, silence):
    """识别音频场景"""
    duration = basic_info["duration"]
    channels = basic_info["channels"]
    dr = dynamic_range["dynamic_range_db"]
    is_rich = spectrum["is_rich_spectrum"]
    silence_ratio = silence["silence_ratio"]
    avg_lufs = loudness["estimated_lufs"]
    
    # 场景识别规则
    if channels == 1 and silence_ratio > 15 and dr < 15:
        if duration > 600:  # 超过10分钟
            scene = "podcast"
            confidence = 0.85
        else:
            scene = "voice_recording"
            confidence = 0.80
    elif is_rich and dr > 10 and channels >= 2:
        scene = "music"
        confidence = 0.90
    elif channels == 1 and dr < 10:
        if duration > 1800:  # 超过30分钟
            scene = "audiobook"
            confidence = 0.75
        else:
            scene = "voice_recording"
            confidence = 0.70
    elif silence_ratio > 30:
        scene = "meeting_recording"
        confidence = 0.65
    else:
        scene = "general"
        confidence = 0.50
    
    scene_names = {
        "music": "音乐",
        "podcast": "播客",
        "voice_recording": "语音录制",
        "audiobook": "有声书",
        "meeting_recording": "会议录音",
        "general": "通用音频"
    }
    
    return {
        "scene": scene,
        "scene_name": scene_names.get(scene, "未知"),
        "confidence": confidence
    }


def detect_problems(clipping, silence, noise, loudness, dynamic_range):
    """检测音频问题"""
    problems = []
    
    # 削波问题
    if clipping["has_clipping"]:
        severity = clipping["severity"]
        problems.append({
            "type": "clipping",
            "severity": severity,
            "description": f"检测到削波失真（{clipping['clipping_rate']:.3f}%）",
            "suggestion": "建议降低输入增益或使用限制器处理"
        })
    
    # 静音问题
    if silence["has_excessive_silence"]:
        problems.append({
            "type": "excessive_silence",
            "severity": "moderate",
            "description": f"静音段过多（{silence['silence_ratio']:.1f}%）",
            "suggestion": "建议使用'截去静音'功能移除多余静音"
        })
    
    # 噪音问题
    if noise["has_noise"] and noise["noise_level"] in ["high", "moderate"]:
        problems.append({
            "type": "noise",
            "severity": noise["noise_level"],
            "description": f"检测到背景噪音（噪底: {noise['noise_floor_db']:.1f}dB）",
            "suggestion": "建议使用'音频降噪'功能处理"
        })
    
    # 响度问题
    lufs = loudness["estimated_lufs"]
    if lufs < -23:
        problems.append({
            "type": "low_loudness",
            "severity": "moderate",
            "description": f"音频响度偏低（约{lufs:.1f} LUFS）",
            "suggestion": "建议使用'音量调整'或'标准化'功能提升响度"
        })
    elif lufs > -10:
        problems.append({
            "type": "high_loudness",
            "severity": "moderate",
            "description": f"音频响度偏高（约{lufs:.1f} LUFS）",
            "suggestion": "建议降低音量避免失真"
        })
    
    # 动态范围问题
    if dynamic_range["is_compressed"]:
        problems.append({
            "type": "over_compression",
            "severity": "mild",
            "description": f"动态范围较小（{dynamic_range['dynamic_range_db']:.1f}dB）",
            "suggestion": "音频可能经过过度压缩，建议使用原始素材"
        })
    
    return problems


def generate_suggestions(scene_info, basic_info, problems, loudness):
    """生成智能建议"""
    scene = scene_info["scene"]
    
    # 场景预设建议
    scene_presets = {
        "music": {
            "format": "FLAC",
            "quality": 320,
            "sample_rate": "48000",
            "channel": "original",
            "encoding": "VBR",
            "processing": ["normalize_loudness"],
            "target_lufs": -14.0,
            "reason": "音乐需要高质量和丰富的动态范围"
        },
        "podcast": {
            "format": "MP3",
            "quality": 128,
            "sample_rate": "44100",
            "channel": "mono",
            "encoding": "CBR",
            "processing": ["denoise", "remove_silence", "normalize_loudness"],
            "target_lufs": -16.0,
            "reason": "播客适合单声道，中等质量即可，需要去噪和去静音"
        },
        "voice_recording": {
            "format": "MP3",
            "quality": 96,
            "sample_rate": "22050",
            "channel": "mono",
            "encoding": "CBR",
            "processing": ["denoise", "normalize_loudness"],
            "target_lufs": -16.0,
            "reason": "语音录制使用单声道和较低采样率可节省空间"
        },
        "audiobook": {
            "format": "MP3",
            "quality": 64,
            "sample_rate": "22050",
            "channel": "mono",
            "encoding": "CBR",
            "processing": ["denoise", "normalize_loudness"],
            "target_lufs": -18.0,
            "reason": "有声书使用低比特率单声道，适合长时间收听"
        },
        "meeting_recording": {
            "format": "MP3",
            "quality": 96,
            "sample_rate": "22050",
            "channel": "mono",
            "encoding": "CBR",
            "processing": ["denoise", "remove_silence", "normalize_loudness"],
            "target_lufs": -16.0,
            "reason": "会议录音需要去除静音段和背景噪音"
        },
        "general": {
            "format": "MP3",
            "quality": 192,
            "sample_rate": "44100",
            "channel": "original",
            "encoding": "VBR",
            "processing": ["normalize_loudness"],
            "target_lufs": -16.0,
            "reason": "通用音频使用标准参数"
        }
    }
    
    preset = scene_presets.get(scene, scene_presets["general"])
    
    # 根据问题调整建议
    processing_steps = list(preset["processing"])
    
    # 添加问题修复步骤
    for problem in problems:
        if problem["type"] == "clipping" and "declip" not in processing_steps:
            processing_steps.insert(0, "declip")
        elif problem["type"] == "noise" and "denoise" not in processing_steps:
            processing_steps.insert(0, "denoise")
        elif problem["type"] == "excessive_silence" and "remove_silence" not in processing_steps:
            processing_steps.append("remove_silence")
    
    return {
        "recommended_format": preset["format"],
        "recommended_quality": preset["quality"],
        "recommended_sample_rate": preset["sample_rate"],
        "recommended_channel": preset["channel"],
        "recommended_encoding": preset["encoding"],
        "processing_steps": processing_steps,
        "target_lufs": preset["target_lufs"],
        "reason": preset["reason"],
        "priority": "high" if len(problems) > 2 else "medium" if len(problems) > 0 else "low"
    }


def calculate_quality_score(clipping, noise, loudness, dynamic_range, silence):
    """计算音频质量评分（0-100）"""
    score = 100.0
    
    # 削波扣分
    if clipping["has_clipping"]:
        if clipping["severity"] == "severe":
            score -= 30
        elif clipping["severity"] == "moderate":
            score -= 20
        else:
            score -= 10
    
    # 噪音扣分
    if noise["has_noise"]:
        if noise["noise_level"] == "high":
            score -= 25
        elif noise["noise_level"] == "moderate":
            score -= 15
        else:
            score -= 5
    
    # 响度扣分
    lufs = loudness["estimated_lufs"]
    if lufs < -30 or lufs > -5:
        score -= 15
    elif lufs < -25 or lufs > -8:
        score -= 8
    
    # 动态范围扣分
    if dynamic_range["is_compressed"]:
        score -= 10
    
    # 静音扣分
    if silence["has_excessive_silence"]:
        score -= 10
    
    score = max(0, min(100, score))
    
    # 评级
    if score >= 90:
        grade = "excellent"
        grade_name = "优秀"
    elif score >= 75:
        grade = "good"
        grade_name = "良好"
    elif score >= 60:
        grade = "fair"
        grade_name = "一般"
    elif score >= 40:
        grade = "poor"
        grade_name = "较差"
    else:
        grade = "very_poor"
        grade_name = "很差"
    
    return {
        "score": float(score),
        "grade": grade,
        "grade_name": grade_name
    }


@router.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """分析音频文件"""
    try:
        # 读取文件
        contents = await file.read()
        file_size = len(contents)
        
        # 保存到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            tmp_file.write(contents)
            tmp_path = tmp_file.name
        
        try:
            # 加载音频
            y, sr = librosa.load(tmp_path, sr=None, mono=False)
            
            # 如果是立体声，转换为单声道用于分析
            if len(y.shape) > 1:
                y_mono = librosa.to_mono(y)
            else:
                y_mono = y
            
            # 执行各项分析
            basic_info = analyze_basic_info(y, sr, file_size)
            loudness = analyze_loudness(y_mono, sr)
            dynamic_range = analyze_dynamic_range(y_mono)
            clipping = detect_clipping(y_mono)
            silence = detect_silence(y_mono, sr)
            spectrum = analyze_spectrum(y_mono, sr)
            noise = estimate_noise_level(y_mono)
            
            # 场景识别
            scene_info = identify_scene(basic_info, loudness, dynamic_range, spectrum, silence)
            
            # 问题检测
            problems = detect_problems(clipping, silence, noise, loudness, dynamic_range)
            
            # 生成建议
            suggestions = generate_suggestions(scene_info, basic_info, problems, loudness)
            
            # 质量评分
            quality_score = calculate_quality_score(clipping, noise, loudness, dynamic_range, silence)
            
            return JSONResponse({
                "success": True,
                "basic_info": basic_info,
                "quality_score": quality_score,
                "loudness": loudness,
                "dynamic_range": dynamic_range,
                "clipping": clipping,
                "silence": silence,
                "spectrum": spectrum,
                "noise": noise,
                "scene": scene_info,
                "problems": problems,
                "suggestions": suggestions
            })
            
        finally:
            # 清理临时文件
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"音频分析失败: {str(e)}")


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "audio_analysis"}
