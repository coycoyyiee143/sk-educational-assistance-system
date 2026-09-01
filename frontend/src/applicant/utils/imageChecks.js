export const MIN_SHORT_SIDE_PX = 800;
export const MIN_SHARPNESS = 150;

export function checkImageResolution(file) {
    if (file.type === "application/pdf") {
        return Promise.resolve({ valid: true, skipped: true });
    }
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const shortSide = Math.min(img.width, img.height);
            resolve({
                valid: shortSide >= MIN_SHORT_SIDE_PX,
                width: img.width,
                height: img.height,
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ valid: false, unreadable: true });
        };
        img.src = url;
    });
}

// Laplacian variance sharpness check. Threshold empirically derived from
// Gaussian-blur tests against a genuine document sample (clear: ~5,865
// variance, mild blur: ~79, heavy blur: ~3). 150 sits above the mild-blur
// case with margin. Runs entirely client-side via Canvas.
export function checkImageSharpness(file) {
    return new Promise((resolve) => {
        if (file.type === "application/pdf") {
            resolve({ valid: true, skipped: true });
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 600 / Math.max(img.width, img.height));
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const w = canvas.width;
            const h = canvas.height;
            const gray = new Float32Array(w * h);
            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];
                const g = imageData.data[i + 1];
                const b = imageData.data[i + 2];
                gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
            }

            let sum = 0;
            let sumSq = 0;
            let count = 0;
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    const lap =
                        gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
                    sum += lap;
                    sumSq += lap * lap;
                    count++;
                }
            }
            const mean = sum / count;
            const variance = sumSq / count - mean * mean;

            URL.revokeObjectURL(url);
            resolve({ valid: variance >= MIN_SHARPNESS, variance: Math.round(variance) });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ valid: false, unreadable: true });
        };
        img.src = url;
    });
}