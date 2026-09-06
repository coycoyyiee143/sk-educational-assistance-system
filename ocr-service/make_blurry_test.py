import sys
from PIL import Image, ImageFilter

def make_blurry(input_path, output_path, blur_radius=3):
    img = Image.open(input_path)
    blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    blurred.save(output_path)
    print(f"Saved blurred version to: {output_path}")

if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "blurred_output.png"
    make_blurry(input_path, output_path)