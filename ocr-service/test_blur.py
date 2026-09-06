import sys
import numpy as np
from PIL import Image
from scipy.signal import convolve2d

def laplacian_variance(image_path, resize_max=600):
    img = Image.open(image_path).convert('L')  # grayscale

    w, h = img.size
    scale = min(1.0, resize_max / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)))

    arr = np.array(img, dtype=np.float64)

    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]])
    lap = convolve2d(arr, kernel, mode='valid')

    return lap.var()

if __name__ == "__main__":
    for path in sys.argv[1:]:
        try:
            v = laplacian_variance(path)
            print(f"{path}\n  Laplacian variance: {v:.2f}\n")
        except Exception as e:
            print(f"{path}\n  Error: {e}\n")