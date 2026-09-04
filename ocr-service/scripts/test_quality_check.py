# ocr-service/scripts/test_quality_check.py
import sys
sys.path.insert(0, '..')
from app.upload_checks.image_quality_check import check_image_quality

for path in sys.argv[1:]:
    result = check_image_quality(path)
    print(f"{path}: passed={result.passed}, variance={result.variance}")