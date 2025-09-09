from PIL import Image
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
    pixels_tuples = [tuple(pixel) for pixel in pixels]
    color_counts = Counter(pixels_tuples)
    dominant_color = color_counts.most_common(1)[0][0]

    # Calculate the new canvas size with left/right padding
    padded_canvas_size = (canvas_size[0] + left_margin + right_margin, canvas_size[1])
    canvas = Image.new("RGB", padded_canvas_size, dominant_color)

    # Resize input image if needed (keeping within the inner area)
    inner_width = padded_canvas_size[0] - left_margin - right_margin
    inner_height = padded_canvas_size[1]
    img = input_image.copy()
    img.thumbnail((inner_width, inner_height), Image.Resampling.LANCZOS)

    # Center horizontally within the padding
    x = left_margin + (inner_width - img.width) // 2
    y = (padded_canvas_size[1] - img.height) // 2
    canvas.paste(img, (x, y))
    return canvas


def image_to_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
