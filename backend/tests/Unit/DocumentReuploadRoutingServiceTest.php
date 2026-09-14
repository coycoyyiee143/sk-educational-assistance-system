<?php

namespace Tests\Unit;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Services\DocumentReuploadRoutingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentReuploadRoutingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected DocumentReuploadRoutingService $routing;

    protected function setUp(): void
    {
        parent::setUp();
        $this->routing = new DocumentReuploadRoutingService();
    }

    protected function makeDoc(Application $application, array $overrides = []): ApplicationDocument
    {
        return ApplicationDocument::factory()->create(array_merge([
            'application_id' => $application->id,
            'document_type'  => 'school_id',
            'status'         => 'processed',
        ], $overrides));
    }

    // ── config wiring ───────────────────────────────────────────

    public function test_capped_categories_reads_from_config()
    {
        config(['document_verification.capped_categories' => ['test_category']]);
        $this->assertEquals(['test_category'], $this->routing->cappedCategories());
    }

    public function test_max_attempts_reads_from_config()
    {
        config(['document_verification.max_attempts' => 5]);
        $this->assertEquals(5, $this->routing->maxAttempts());
    }

    // ── isCappedCategory() ──────────────────────────────────────

    public function test_is_capped_category_true_for_listed_category()
    {
        $this->assertTrue($this->routing->isCappedCategory('wrong_document_type'));
        $this->assertTrue($this->routing->isCappedCategory('name_mismatch'));
        $this->assertTrue($this->routing->isCappedCategory('institution_mismatch'));
    }

    public function test_is_capped_category_false_for_low_quality()
    {
        // low_quality is deliberately excluded from the cap — see
        // AUTO_REUPLOAD_VERIFICATION_RULES.md.
        $this->assertFalse($this->routing->isCappedCategory('low_quality'));
    }

    public function test_is_capped_category_false_for_null()
    {
        $this->assertFalse($this->routing->isCappedCategory(null));
    }

    // ── shouldEscalate() ────────────────────────────────────────

    public function test_does_not_escalate_below_max_attempts()
    {
        $application = Application::factory()->create();

        // 2 prior wrong_document_type attempts + current = 3 total.
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $current = $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);

        $this->assertFalse($this->routing->shouldEscalate($application, $current));
    }

    public function test_escalates_on_fourth_attempt()
    {
        $application = Application::factory()->create();

        // 3 prior + current = 4 total -> exceeds max_attempts (3).
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $current = $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);

        $this->assertTrue($this->routing->shouldEscalate($application, $current));
    }

    public function test_never_escalates_low_quality_no_matter_how_many_attempts()
    {
        $application = Application::factory()->create();

        for ($i = 0; $i < 5; $i++) {
            $this->makeDoc($application, ['auto_reupload_category' => 'low_quality']);
        }
        $current = $this->makeDoc($application, ['auto_reupload_category' => 'low_quality']);

        $this->assertFalse($this->routing->shouldEscalate($application, $current));
    }

    public function test_mixed_capped_categories_on_same_document_type_count_together()
    {
        // Matches the original whereIn() behavior: 2 wrong_document_type
        // + 2 wrong_cert_year on the SAME document_type count toward the
        // SAME cap, not tracked separately per category.
        $application = Application::factory()->create();

        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_document_type']);
        $this->makeDoc($application, ['auto_reupload_category' => 'wrong_cert_year']);
        $current = $this->makeDoc($application, ['auto_reupload_category' => 'wrong_cert_year']);

        // 4 total across both categories on this document type -> escalate.
        $this->assertTrue($this->routing->shouldEscalate($application, $current));
    }

    public function test_name_mismatch_category_participates_in_the_same_cap()
    {
        $application = Application::factory()->create();

        $this->makeDoc($application, ['auto_reupload_category' => 'name_mismatch']);
        $this->makeDoc($application, ['auto_reupload_category' => 'name_mismatch']);
        $this->makeDoc($application, ['auto_reupload_category' => 'name_mismatch']);
        $current = $this->makeDoc($application, ['auto_reupload_category' => 'name_mismatch']);

        $this->assertTrue($this->routing->shouldEscalate($application, $current));
    }

    public function test_different_document_types_do_not_share_a_cap()
    {
        // 3 prior wrong_document_type attempts on registration_form
        // should NOT count against a school_id document, even on the
        // same application.
        $application = Application::factory()->create();

        $this->makeDoc($application, [
            'document_type' => 'registration_form',
            'auto_reupload_category' => 'wrong_document_type',
        ]);
        $this->makeDoc($application, [
            'document_type' => 'registration_form',
            'auto_reupload_category' => 'wrong_document_type',
        ]);
        $this->makeDoc($application, [
            'document_type' => 'registration_form',
            'auto_reupload_category' => 'wrong_document_type',
        ]);

        $schoolIdDoc = $this->makeDoc($application, [
            'document_type' => 'school_id',
            'auto_reupload_category' => 'wrong_document_type',
        ]);

        $this->assertFalse($this->routing->shouldEscalate($application, $schoolIdDoc));
    }

    // ── attemptHistory() ────────────────────────────────────────

    public function test_attempt_history_returns_reasons_in_version_order()
    {
        $application = Application::factory()->create();

        $this->makeDoc($application, [
            'auto_reupload_category' => 'wrong_document_type',
            'auto_reupload_reason'   => 'First reason',
            'version'                => 1,
        ]);
        $this->makeDoc($application, [
            'auto_reupload_category' => 'wrong_document_type',
            'auto_reupload_reason'   => 'Second reason',
            'version'                => 2,
        ]);
        $current = $this->makeDoc($application, [
            'auto_reupload_category' => 'wrong_document_type',
            'auto_reupload_reason'   => 'Third reason',
            'version'                => 3,
        ]);

        $history = $this->routing->attemptHistory($application, $current);

        $this->assertEquals(['First reason', 'Second reason', 'Third reason'], $history);
    }

    public function test_attempt_history_filters_out_null_reasons()
    {
        $application = Application::factory()->create();

        $this->makeDoc($application, [
            'auto_reupload_category' => 'wrong_document_type',
            'auto_reupload_reason'   => null,
            'version'                => 1,
        ]);
        $current = $this->makeDoc($application, [
            'auto_reupload_category' => 'wrong_document_type',
            'auto_reupload_reason'   => 'Only real reason',
            'version'                => 2,
        ]);

        $history = $this->routing->attemptHistory($application, $current);

        $this->assertEquals(['Only real reason'], $history);
    }
}