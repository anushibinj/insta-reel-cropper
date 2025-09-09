from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
from image_utils import create_vertical_image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # This regex matches any subdomain of fastorial.dev with http or https, with or without www.
    allow_origin_regex=r"https:\/\/.*\.fastorial\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/generate")
async def generate_image(
    file: UploadFile = File(...),
    verticalPadding: int = Form(0),  # name matches frontend field
):
    contents = await file.read()
    screenshot = Image.open(io.BytesIO(contents)).convert("RGB")
    # If verticalPadding is intended as left/right margin (same value both sides):
    result_img = create_vertical_image(
        screenshot,
        left_margin=verticalPadding,
        right_margin=verticalPadding,
    )
    buf = io.BytesIO()
    result_img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
