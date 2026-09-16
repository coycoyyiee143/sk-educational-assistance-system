<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\SkEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SkEventControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeAdmin()
    {
        return User::factory()->create(['role' => 'sk_admin']);
    }

    protected function makeApplicant()
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    // ── Public index/show ──────────────────────────────────────────

    public function test_public_can_list_events_without_authentication()
    {
        $admin = $this->makeAdmin();
        SkEvent::create([
            'title' => 'Published Event', 'description' => 'Desc', 'event_date' => now()->addDays(5),
            'venue' => 'Barangay Hall', 'is_published' => true, 'posted_by' => $admin->id,
        ]);
        SkEvent::create([
            'title' => 'Draft Event', 'description' => 'Desc', 'event_date' => now()->addDays(6),
            'venue' => 'Barangay Hall', 'is_published' => false, 'posted_by' => $admin->id,
        ]);

        $response = $this->getJson('/api/events');

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['title' => 'Published Event']);
    }

    public function test_public_show_returns_published_event()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'Visible Event', 'description' => 'Desc', 'event_date' => now()->addDays(3),
            'venue' => 'Court', 'is_published' => true, 'posted_by' => $admin->id,
        ]);

        $response = $this->getJson("/api/events/{$event->id}");

        $response->assertOk();
        $response->assertJsonFragment(['title' => 'Visible Event']);
    }

    public function test_public_show_returns_404_for_unpublished_event()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'Hidden Event', 'description' => 'Desc', 'event_date' => now()->addDays(3),
            'venue' => 'Court', 'is_published' => false, 'posted_by' => $admin->id,
        ]);

        $response = $this->getJson("/api/events/{$event->id}");

        $response->assertStatus(404);
    }

    public function test_deleted_event_no_longer_appears_publicly()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'Temporary Event', 'description' => 'Desc', 'event_date' => now()->addDays(3),
            'venue' => 'Court', 'is_published' => true, 'posted_by' => $admin->id,
        ]);

        $event->delete();

        $response = $this->getJson('/api/events');
        $response->assertOk();
        $response->assertJsonMissing(['title' => 'Temporary Event']);

        $showResponse = $this->getJson("/api/events/{$event->id}");
        $showResponse->assertStatus(404);
    }

    // ── Access control ──────────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_event_routes()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/admin/events');

        $response->assertStatus(403);
    }

    public function test_admin_index_requires_authentication()
    {
        $response = $this->getJson('/api/admin/events');

        $response->assertStatus(401);
    }

    // ── Admin index (includes unpublished) ────────────────────────────

    public function test_admin_index_lists_both_published_and_unpublished_events()
    {
        $admin = $this->makeAdmin();
        SkEvent::create([
            'title' => 'Pub', 'event_date' => now()->addDays(1), 'is_published' => true, 'posted_by' => $admin->id,
        ]);
        SkEvent::create([
            'title' => 'Unpub', 'event_date' => now()->addDays(2), 'is_published' => false, 'posted_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/events');

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    // ── store() ────────────────────────────────────────────────────

    public function test_admin_can_create_event_without_image()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/events', [
            'title'       => 'New Event',
            'description' => 'Event description',
            'event_date'  => now()->addDays(10)->toDateString(),
            'venue'       => 'Covered Court',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('sk_events', [
            'title'        => 'New Event',
            'posted_by'    => $admin->id,
            'is_published' => true,
        ]);
    }

    public function test_admin_can_create_event_with_image()
    {
        Storage::fake('public');
        $admin = $this->makeAdmin();
        $image = UploadedFile::fake()->image('event.jpg');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/events', [
            'title'       => 'Event With Image',
            'description' => 'Desc',
            'event_date'  => now()->addDays(10)->toDateString(),
            'venue'       => 'Court',
            'image'       => $image,
        ]);

        $response->assertStatus(201);
        $event = SkEvent::where('title', 'Event With Image')->first();
        $this->assertNotNull($event->image_path);
        Storage::disk('public')->assertExists($event->image_path);
    }

    public function test_create_event_requires_title()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/events', [
            'event_date' => now()->addDays(10)->toDateString(),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['title']);
    }

    public function test_create_event_requires_event_date()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/events', [
            'title' => 'Event Missing Date',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['event_date']);
    }

    // ── update() ───────────────────────────────────────────────────

    public function test_admin_can_update_event()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'Old Title', 'event_date' => now()->addDays(1), 'is_published' => true, 'posted_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/events/{$event->id}", [
            'title'      => 'Updated Title',
            'event_date' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('sk_events', [
            'id'    => $event->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_update_event_requires_title()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'Old Title', 'event_date' => now()->addDays(1), 'is_published' => true, 'posted_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/events/{$event->id}", [
            'event_date' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertStatus(422);
    }

    // ── destroy() ──────────────────────────────────────────────────

    public function test_admin_can_delete_event()
    {
        $admin = $this->makeAdmin();
        $event = SkEvent::create([
            'title' => 'To Delete', 'event_date' => now()->addDays(1), 'is_published' => true, 'posted_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/events/{$event->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('sk_events', ['id' => $event->id]);
    }

    public function test_deleting_event_removes_stored_image()
    {
        Storage::fake('public');
        $admin = $this->makeAdmin();
        $path = UploadedFile::fake()->image('event.jpg')->store('events', 'public');
        $event = SkEvent::create([
            'title' => 'Event With Image', 'event_date' => now()->addDays(1),
            'is_published' => true, 'posted_by' => $admin->id, 'image_path' => $path,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/events/{$event->id}");

        $response->assertOk();
        Storage::disk('public')->assertMissing($path);
    }
}
