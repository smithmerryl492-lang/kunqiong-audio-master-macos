from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import audio_convert, file_system, audio_cut, video_extract, audio_merge, audio_to_text, volume_adjust, audio_record, audio_compress, audio_speed, audio_fade, audio_reverse, audio_denoise, audio_echo, audio_silence, audio_bgm, audio_equalizer, audio_cover, video_replace_audio, noise_generator, vocal_extract, bgm_library, video_remove_vocal, vocal_enhance, text_to_speech, sound_effect, translate, voice_change, audio_analysis, task_api
from routers.config import UPLOAD_DIR, OUTPUT_DIR
import os
import asyncio
import requests
import time

API_BASE = "https://api-web.kunqiongai.com"
SOFT_NUMBER = "10003"
AUTH_CACHE_TTL = 60
AUTH_CACHE = {}


from utils.i18n import t

app = FastAPI(
    title=t("api.title"),
    description=t("api.description"),
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def validate_auth_code(request: Request) -> None:
    auth_code = request.headers.get("X-Auth-Code")
    if not auth_code:
        return
    device_id = request.headers.get("X-Device-Id")
    if not device_id:
        return
    cache_key = (device_id, auth_code)
    now = time.time()
    cached = AUTH_CACHE.get(cache_key)
    if cached is not None:
        expires_at, status = cached
        if now < expires_at and status == "ok":
            return

    def do_request():
        data = {
            "device_id": device_id,
            "soft_number": SOFT_NUMBER,
            "auth_code": auth_code,
        }
        return requests.post(
            f"{API_BASE}/soft_desktop/check_auth_code_valid",
            data=data,
            timeout=5,
        )

    try:
        response = await asyncio.to_thread(do_request)
    except Exception:
        return

    if not response.ok:
        raise HTTPException(status_code=403, detail="AUTH_CODE_CHECK_FAILED")

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(status_code=403, detail="AUTH_CODE_CHECK_FAILED")

    if payload.get("code") != 1:
        raise HTTPException(status_code=403, detail="AUTH_CODE_CHECK_FAILED")

    data = payload.get("data") or {}
    if data.get("auth_code_status") != 1:
        raise HTTPException(status_code=403, detail="AUTH_CODE_EXPIRED")

    AUTH_CACHE[cache_key] = (time.time() + AUTH_CACHE_TTL, "ok")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        await validate_auth_code(request)
    response = await call_next(request)
    return response


os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 注册路由
app.include_router(audio_convert.router, prefix="/api/convert", tags=[t("tags.convert")])
app.include_router(file_system.router, prefix="/api/fs", tags=[t("tags.fs")])
app.include_router(audio_cut.router, prefix="/api/cut", tags=[t("tags.cut")])
app.include_router(video_extract.router, prefix="/api/video/extract", tags=[t("tags.video_extract")])
app.include_router(audio_merge.router, prefix="/api/merge", tags=[t("tags.merge")])
app.include_router(audio_to_text.router, prefix="/api/transcribe", tags=[t("tags.transcribe")])
app.include_router(volume_adjust.router, prefix="/api/volume", tags=[t("tags.volume")])
app.include_router(audio_record.router, prefix="/api/record", tags=[t("tags.record")])
app.include_router(audio_compress.router, prefix="/api/compress", tags=[t("tags.compress")])
app.include_router(audio_speed.router, prefix="/api/speed", tags=[t("tags.speed")])
app.include_router(audio_fade.router, prefix="/api/fade", tags=[t("tags.fade")])
app.include_router(audio_reverse.router, prefix="/api/reverse", tags=[t("tags.reverse")])
app.include_router(audio_denoise.router, prefix="/api/denoise", tags=[t("tags.denoise")])
app.include_router(audio_echo.router, prefix="/api/echo", tags=[t("tags.echo")])
app.include_router(audio_silence.router, prefix="/api/silence", tags=[t("tags.silence")])
app.include_router(audio_bgm.router, prefix="/api/bgm", tags=[t("tags.bgm")])
app.include_router(audio_equalizer.router, prefix="/api/equalizer", tags=[t("tags.equalizer")])
app.include_router(audio_cover.router, prefix="/api/cover", tags=[t("tags.cover")])
app.include_router(video_replace_audio.router, prefix="/api/video/replace", tags=[t("tags.video_replace")])
app.include_router(noise_generator.router, prefix="/api/noise", tags=[t("tags.noise")])
app.include_router(vocal_extract.router, prefix="/api/vocal", tags=[t("tags.vocal")])
app.include_router(bgm_library.router, tags=[t("tags.bgm_library")])
app.include_router(video_remove_vocal.router, prefix="/api/video/remove-vocal", tags=[t("tags.video_remove_vocal")])
app.include_router(vocal_enhance.router, prefix="/api/vocal-enhance", tags=[t("tags.vocal_enhance")])
app.include_router(text_to_speech.router, prefix="/api/tts", tags=[t("tags.tts")])
app.include_router(sound_effect.router, prefix="/api/effect", tags=[t("tags.effect")])
app.include_router(translate.router, prefix="/api/translate", tags=[t("tags.translate")])
app.include_router(voice_change.router, prefix="/api/voice", tags=[t("tags.voice")])
app.include_router(audio_analysis.router, prefix="/api/analysis", tags=[t("tags.analysis")])
app.include_router(task_api.router, prefix="/api/tasks", tags=[t("tags.tasks")])

@app.get("/")
async def root():
    return {"message": t("api.running")}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
