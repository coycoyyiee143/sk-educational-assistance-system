<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Jobs\ProcessOcrDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

class DocumentControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeApplicant(): User
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    protected function makeApplicationFor(User $user, array $overrides = []): Application
    {
        $config = $overrides['config'] ?? ApplicationConfiguration::factory()->alreadyStarted()->create();
        unset($overrides['config']);

        return Application::factory()->create(array_merge([
            'user_id'   => $user->id,
            'config_id' => $config->id,
            'status'    => 'draft_incomplete',
        ], $overrides));
    }

    // ── upload() ────────────────────────────────────────────────

    public function test_upload_stores_document_and_dispatches_ocr_job()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);

        $file = UploadedFile::fake()->image('school_id.jpg');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('application_documents', [
            'application_id' => $app->id,
            'document_type'  => 'school_id',
            'status'         => 'processing',
        ]);
        Queue::assertPushed(ProcessOcrDocument::class);
    }

    public function test_upload_marks_application_pending_prescreening_once_three_documents_present()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);

        ApplicationDocument::factory()->create(['application_id' => $app->id, 'document_type' => 'registration_form']);
        ApplicationDocument::factory()->create(['application_id' => $app->id, 'document_type' => 'voters_certificate']);

        $file = UploadedFile::fake()->image('school_id.jpg');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('applications', [
            'id'     => $app->id,
            'status' => 'pending_prescreening',
        ]);
    }

    public function test_upload_rejects_unsupported_file_type()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);

        $file = UploadedFile::fake()->create('malware.exe', 100, 'application/octet-stream');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['file']);
        Queue::assertNothingPushed();
    }

    public function test_upload_rejects_oversized_file()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);

        // max is 5120 KB
        $file = UploadedFile::fake()->create('big.pdf', 6000, 'application/pdf');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['file']);
    }

    public function test_upload_rejects_when_application_period_closed()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $config = ApplicationConfiguration::factory()->closed()->create();
        $app = $this->makeApplicationFor($applicant, ['config' => $config]);

        $file = UploadedFile::fake()->image('school_id.jpg');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(400);
        $response->assertJsonFragment([
            'message' => 'The application period has closed. Document uploads are no longer accepted.',
        ]);
    }

    public function test_upload_rejects_when_application_belongs_to_another_applicant()
    {
        Queue::fake();
        Storage::fake('local');

        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $app = $this->makeApplicationFor($owner);

        $file = UploadedFile::fake()->image('school_id.jpg');

        $response = $this->actingAs($stranger, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents", [
                'document_type' => 'school_id',
                'file'          => $file,
            ]);

        $response->assertStatus(404);
    }

    // ── reupload() ──────────────────────────────────────────────

    public function test_reupload_creates_new_version_and_resets_status()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant, ['status' => 'reupload_requested']);
        $doc = ApplicationDocument::factory()->create([
            'application_id' => $app->id,
            'document_type'  => 'school_id',
            'version'        => 1,
        ]);

        $file = UploadedFile::fake()->image('school_id_v2.jpg');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents/{$doc->id}/reupload", [
                'file' => $file,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('application_documents', [
            'application_id' => $app->id,
            'document_type'  => 'school_id',
            'version'        => 2,
        ]);
        $this->assertDatabaseHas('applications', [
            'id'     => $app->id,
            'status' => 'pending_prescreening',
        ]);
        Queue::assertPushed(ProcessOcrDocument::class);
    }

    public function test_reupload_rejects_unsupported_file_type()
    {
        Queue::fake();
        Storage::fake('local');

        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant, ['status' => 'reupload_requested']);
        $doc = ApplicationDocument::factory()->create(['application_id' => $app->id]);

        $file = UploadedFile::fake()->create('malware.exe', 100, 'application/octet-stream');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/documents/{$doc->id}/reupload", [
                'file' => $file,
            ]);

        $response->assertStatus(422);
    }

    // ── index() ─────────────────────────────────────────────────

    public function test_index_returns_documents_for_own_application()
    {
        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);
        ApplicationDocument::factory()->count(2)->create(['application_id' => $app->id]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson("/api/applications/{$app->id}/documents");

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    public function test_applicant_cannot_view_another_applicants_documents()
    {
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $app = $this->makeApplicationFor($owner);
        ApplicationDocument::factory()->create(['application_id' => $app->id]);

        $response = $this->actingAs($stranger, 'sanctum')->getJson("/api/applications/{$app->id}/documents");

        $response->assertStatus(404);
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_streams_document_file_for_owner()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();
        $app = $this->makeApplicationFor($applicant);

        $file = UploadedFile::fake()->image('school_id.jpg');
        $path = $file->storeAs("documents/{$app->id}", 'school_id.jpg', 'local');

        $doc = ApplicationDocument::factory()->create([
            'application_id' => $app->id,
            'file_path'      => $path,
            'file_name'      => 'school_id.jpg',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson("/api/applications/{$app->id}/documents/{$doc->id}/file");

        $response->assertOk();
    }

    public function test_show_forbidden_for_unrelated_applicant()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $app = $this->makeApplicationFor($owner);

        $file = UploadedFile::fake()->image('school_id.jpg');
        $path = $file->storeAs("documents/{$app->id}", 'school_id.jpg', 'local');

        $doc = ApplicationDocument::factory()->create([
            'application_id' => $app->id,
            'file_path'      => $path,
            'file_name'      => 'school_id.jpg',
        ]);

        $response = $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/applications/{$app->id}/documents/{$doc->id}/file");

        $response->assertStatus(403);
    }

    public function test_show_allows_verifier_to_view_any_applicants_document()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $app = $this->makeApplicationFor($owner);

        $file = UploadedFile::fake()->image('school_id.jpg');
        $path = $file->storeAs("documents/{$app->id}", 'school_id.jpg', 'local');

        $doc = ApplicationDocument::factory()->create([
            'application_id' => $app->id,
            'file_path'      => $path,
            'file_name'      => 'school_id.jpg',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson("/api/applications/{$app->id}/documents/{$doc->id}/file");

        $response->assertOk();
    }
}
