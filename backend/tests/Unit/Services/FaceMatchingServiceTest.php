<?php

namespace Tests\Unit\Services;

use App\Services\FaceMatchingService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FaceMatchingServiceTest extends TestCase
{
    protected FaceMatchingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new FaceMatchingService();
    }

    // ── embeddingDistance() ──────────────────────────────────────

    public function test_distance_between_identical_embeddings_is_zero()
    {
        $embedding = [0.1, 0.2, 0.3, 0.4];
        $this->assertEqualsWithDelta(0.0, $this->service->embeddingDistance($embedding, $embedding), 0.0001);
    }

    public function test_distance_matches_known_euclidean_result()
    {
        // 3-4-5 triangle: sqrt((3-0)^2 + (4-0)^2) = 5.
        $a = [3.0, 4.0];
        $b = [0.0, 0.0];
        $this->assertEqualsWithDelta(5.0, $this->service->embeddingDistance($a, $b), 0.0001);
    }

    public function test_distance_treats_missing_trailing_dimensions_as_zero()
    {
        $a = [3.0, 4.0];
        $b = [0.0];
        $this->assertEqualsWithDelta(5.0, $this->service->embeddingDistance($a, $b), 0.0001);
    }

    public function test_distance_is_symmetric()
    {
        $a = [1.0, 2.0, 3.0];
        $b = [4.0, 0.0, -1.0];

        $this->assertEqualsWithDelta(
            $this->service->embeddingDistance($a, $b),
            $this->service->embeddingDistance($b, $a),
            0.0001
        );
    }

    // ── compareAgainstEmbedding() ─────────────────────────────────

    public function test_compare_against_embedding_returns_match_on_success()
    {
        Http::fake([
            '*/verify-against-embedding' => Http::response(['match' => true, 'score' => 0.92], 200),
        ]);

        $tmp = tempnam(sys_get_temp_dir(), 'face');
        file_put_contents($tmp, 'fake-image-bytes');

        $result = $this->service->compareAgainstEmbedding($tmp, [0.1, 0.2, 0.3]);

        $this->assertTrue($result['match']);
        $this->assertEqualsWithDelta(0.92, $result['score'], 0.0001);

        @unlink($tmp);
    }

    public function test_compare_against_embedding_returns_no_match_when_service_errors()
    {
        Http::fake([
            '*/verify-against-embedding' => Http::response(['error' => 'service down'], 500),
        ]);

        $tmp = tempnam(sys_get_temp_dir(), 'face');
        file_put_contents($tmp, 'fake-image-bytes');

        $result = $this->service->compareAgainstEmbedding($tmp, [0.1, 0.2, 0.3]);

        $this->assertFalse($result['match']);
        $this->assertEquals(0, $result['score']);
        $this->assertArrayHasKey('error', $result);

        @unlink($tmp);
    }
}
