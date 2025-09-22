from PIL import Image, ImageOps
import numpy as np
from collections import Counter
import io


def clean_image_corners(img, corner_size=50, brightness_threshold=1):
    """
    Replaces bright/noise pixels in each corner with the dominant background color.
    """
    img_np = np.array(img)
    h, w, _ = img_np.shape

    # Find dominant color (most common pixel)
    pixels = img_np.reshape(-1, 3)
    pixels_tuples = [tuple(pixel) for pixel in pixels]
    color_counts = Counter(pixels_tuples)
    dominant_color = color_counts.most_common(1)[0][0]

    # Define four image corner areas
    corners = [
        (0, corner_size, 0, corner_size),  # top-left
        (0, corner_size, w - corner_size, w),  # top-right
        (h - corner_size, h, 0, corner_size),  # bottom-left
        (h - corner_size, h, w - corner_size, w),  # bottom-right
    ]

    def is_bright(pixel):
        return (
            np.mean(pixel) > brightness_threshold
        )  # You can adjust 200 for stricter/softer cleaning

    for r_start, r_end, c_start, c_end in corners:
        subregion = img_np[r_start:r_end, c_start:c_end]
        bright_mask = np.apply_along_axis(is_bright, 2, subregion)
        subregion[bright_mask] = dominant_color
        img_np[r_start:r_end, c_start:c_end] = subregion

    return Image.fromarray(img_np)


def create_vertical_image(
    input_image: Image.Image,
    canvas_size=(1080, 1920),
    left_margin=100,  # set your desired left margin here
    right_margin=100,  # set your desired right margin here
) -> Image.Image:

    # Clean noise in image corners
    input_image = clean_image_corners(input_image)

    img_array = np.array(input_image)
    pixels = img_array.reshape(-1, 3)
    dominant_color = tuple(Counter(map(tuple, pixels)).most_common(1)[0][0])

    # Create a fixed-size canvas (do NOT add margins to canvas size)
    canvas_w, canvas_h = canvas_size
    canvas = Image.new("RGB", (canvas_w, canvas_h), dominant_color)

    # Compute inner area size (space available between margins)
    inner_w = max(1, canvas_w - left_margin - right_margin)
    inner_h = canvas_h

    # Resize the image to fit WITHIN the inner area, preserving aspect ratio
    # Option A: ImageOps.contain (does not modify original)
    resized = ImageOps.contain(
        input_image, (inner_w, inner_h), method=Image.Resampling.LANCZOS
    )

    # Center horizontally within margins, and vertically on canvas
    x = left_margin + (inner_w - resized.width) // 2
    y = (canvas_h - resized.height) // 2

    canvas.paste(resized, (x, y))
    return canvas


def image_to_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
