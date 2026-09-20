export const MIN_SHORT_SIDE_PX = 800;
export const MIN_SHARPNESS = 150;
export const MIN_WHITE_BORDER_RATIO = 0.6;

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

// A genuine 2x2 photo is shot against a plain white backdrop, so the
// border of the frame (where the backdrop shows, not the subject) should
// be almost entirely near-white pixels. We sample a thin ring around the
// edge of the image rather than the whole frame, since the subject's
// head/shoulders fill the center and would otherwise skew the result.
export function checkWhiteBackground(file) {
    return new Promise((resolve) => {
        if (file.type === "application/pdf") {
            resolve({ valid: true, skipped: true });
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 400 / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);

            const { data } = ctx.getImageData(0, 0, w, h);
            const borderThickness = Math.max(1, Math.round(Math.min(w, h) * 0.06));

            const isNearWhite = (r, g, b) => {
                const min = Math.min(r, g, b);
                const max = Math.max(r, g, b);
                return min >= 225 && max - min <= 15;
            };

            let whiteCount = 0;
            let total = 0;
            for (let y = 0; y < h; y++) {
                const onBorderRow = y < borderThickness || y >= h - borderThickness;
                for (let x = 0; x < w; x++) {
                    if (!onBorderRow && x >= borderThickness && x < w - borderThickness) continue;
                    const idx = (y * w + x) * 4;
                    total++;
                    if (isNearWhite(data[idx], data[idx + 1], data[idx + 2])) whiteCount++;
                }
            }

            URL.revokeObjectURL(url);
            const ratio = total > 0 ? whiteCount / total : 0;
            resolve({ valid: ratio >= MIN_WHITE_BORDER_RATIO, ratio: Math.round(ratio * 100) / 100 });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ valid: false, unreadable: true });
        };
        img.src = url;
    });
}