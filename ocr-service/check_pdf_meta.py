import pikepdf
import sys

def inspect(path):
    print(f"\n--- {path} ---")
    try:
        pdf = pikepdf.open(path)
        print("Producer:", pdf.docinfo.get('/Producer', '(none)'))
        print("Creator:", pdf.docinfo.get('/Creator', '(none)'))
        print("All docinfo keys:", dict(pdf.docinfo))
    except Exception as e:
        print("Error reading PDF:", e)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        inspect(path)