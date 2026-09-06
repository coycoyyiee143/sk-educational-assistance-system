<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin wrapper around the Python face-matching microservice.
 * Keeps all HTTP/JSON details out of the controller.
 *
 * Expects the microservice to run locally on the same VPS
 * (see FACE_SERVICE_URL in .env, default http://127.0.0.1:5001).
 */
class FaceMatchingService
{
    protected string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.face_service.url', 'http://127.0.0.1:5001'), '/');
    }

    /**
     * Compare two images directly (used at registration: ID photo vs live cam).
     * Returns ['match' => bool, 'score' => float, 'embedding' => array|null]
     */
    public function compareImages(
        string $idImagePath,
        string $livePhotoPath,
        ?string $idFilename = null,
        ?string $liveFilename = null
    ): array
    {
        try {
            // Filenames matter here: PHP's temp upload path (getRealPath())
            // has no real extension (e.g. "phpA1B2.tmp"), which the face
            // service's file-type check would reject. Passing the client's
            // ORIGINAL filename explicitly keeps the extension intact.
            $idFilename = $idFilename ?? basename($idImagePath);
            $liveFilename = $liveFilename ?? basename($livePhotoPath);

            $response = Http::timeout(20)
                ->attach('id_image', file_get_contents($idImagePath), $idFilename)
                ->attach('live_photo', file_get_contents($livePhotoPath), $liveFilename)
                ->post("{$this->baseUrl}/verify-face");

            $data = $response->json();

            if (!$response->successful()) {
                Log::warning('Face service compareImages failed', ['status' => $response->status()]);

                // 422 = the service itself rejected the image (bad shape,
                // no face found, etc.) and gave us a specific reason —
                // pass that straight through instead of a generic message.
                $message = ($response->status() === 422 && isset($data['error']))
                    ? $data['error']
                    : 'Face service unavailable.';

                return ['match' => false, 'score' => 0, 'embedding' => null, 'error' => $message];
            }

            return [
                'match'     => (bool) ($data['match'] ?? false),
                'score'     => (float) ($data['score'] ?? 0),
                'embedding' => $data['embedding'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::error('Face service compareImages exception: ' . $e->getMessage());
            return ['match' => false, 'score' => 0, 'embedding' => null, 'error' => 'Face service unreachable.'];
        }
    }

    /**
     * Compare a freshly captured photo (claiming day) against a previously
     * stored embedding, so we don't need to re-read the original ID image.
     * Returns ['match' => bool, 'score' => float]
     */
    public function compareAgainstEmbedding(string $livePhotoPath, array $storedEmbedding): array
    {
        try {
            $response = Http::timeout(20)
                ->attach('live_photo', file_get_contents($livePhotoPath), basename($livePhotoPath))
                ->post("{$this->baseUrl}/verify-against-embedding", [
                    'embedding' => json_encode($storedEmbedding),
                ]);

            if (!$response->successful()) {
                Log::warning('Face service compareAgainstEmbedding failed', ['status' => $response->status()]);
                return ['match' => false, 'score' => 0, 'error' => 'Face service unavailable.'];
            }

            $data = $response->json();

            return [
                'match' => (bool) ($data['match'] ?? false),
                'score' => (float) ($data['score'] ?? 0),
            ];
        } catch (\Throwable $e) {
            Log::error('Face service compareAgainstEmbedding exception: ' . $e->getMessage());
            return ['match' => false, 'score' => 0, 'error' => 'Face service unreachable.'];
        }
    }

    /**
     * Euclidean distance between two 128-d embeddings, computed directly in
     * PHP since we already have both vectors in hand — no need to round-trip
     * to the Python service for a plain distance calculation. Used for
     * cross-user face duplicate checks at registration.
     */
    public function embeddingDistance(array $a, array $b): float
    {
        $sum = 0.0;
        foreach ($a as $i => $val) {
            $diff = $val - ($b[$i] ?? 0);
            $sum += $diff * $diff;
        }
        return sqrt($sum);
    }
}