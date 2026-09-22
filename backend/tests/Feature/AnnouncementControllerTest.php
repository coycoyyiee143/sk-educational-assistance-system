<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Announcement;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AnnouncementControllerTest extends TestCase
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

    public function test_public_can_list_announcements_without_authentication()
    {
        $admin = $this->makeAdmin();
        Announcement::create([
            'title' => 'Published One', 'content' => 'Content A', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);
        Announcement::create([
            'title' => 'Unpublished One', 'content' => 'Content B', 'category' => 'General',
            'is_published' => false, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->getJson('/api/announcements');

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['title' => 'Published One']);
    }

    public function test_public_show_returns_published_announcement()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'Visible', 'content' => 'Body text', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->getJson("/api/announcements/{$announcement->id}");

        $response->assertOk();
        $response->assertJsonFragment(['title' => 'Visible']);
    }

    public function test_public_show_returns_404_for_unpublished_announcement()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'Hidden', 'content' => 'Body text', 'category' => 'General',
            'is_published' => false, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->getJson("/api/announcements/{$announcement->id}");

        $response->assertStatus(404);
    }

    public function test_deleted_announcement_no_longer_appears_publicly()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'Temporary', 'content' => 'Body', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $announcement->delete();

        $response = $this->getJson('/api/announcements');
        $response->assertOk();
        $response->assertJsonMissing(['title' => 'Temporary']);

        $showResponse = $this->getJson("/api/announcements/{$announcement->id}");
        $showResponse->assertStatus(404);
    }

    // ── Access control ──────────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_announcement_routes()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/admin/announcements');

        $response->assertStatus(403);
    }

    public function test_admin_index_requires_authentication()
    {
        $response = $this->getJson('/api/admin/announcements');

        $response->assertStatus(401);
    }

    // ── Admin index (includes unpublished) ────────────────────────────

    public function test_admin_index_lists_both_published_and_unpublished_announcements()
    {
        $admin = $this->makeAdmin();
        Announcement::create([
            'title' => 'Pub', 'content' => 'C', 'is_published' => true,
            'posted_by' => $admin->id, 'published_at' => now(),
        ]);
        Announcement::create([
            'title' => 'Unpub', 'content' => 'C', 'is_published' => false,
            'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/announcements');

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    // ── store() ────────────────────────────────────────────────────

    public function test_admin_can_create_announcement()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/announcements', [
            'title'    => 'New Announcement',
            'content'  => 'Some important content.',
            'category' => 'General',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('announcements', [
            'title'        => 'New Announcement',
            'posted_by'    => $admin->id,
            'is_published' => true,
        ]);
    }

    public function test_create_announcement_requires_title()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/announcements', [
            'content' => 'Missing a title.',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['title']);
    }

    public function test_create_announcement_requires_content()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/announcements', [
            'title' => 'A title with no content',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['content']);
    }

    // ── update() ───────────────────────────────────────────────────

    public function test_admin_can_update_announcement()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'Old Title', 'content' => 'Old content', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/announcements/{$announcement->id}", [
            'title'   => 'Updated Title',
            'content' => 'Updated content',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('announcements', [
            'id'    => $announcement->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_update_announcement_requires_title()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'Old Title', 'content' => 'Old content', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/announcements/{$announcement->id}", [
            'content' => 'Updated content without title',
        ]);

        $response->assertStatus(422);
    }

    // ── destroy() ──────────────────────────────────────────────────

    public function test_admin_can_delete_announcement()
    {
        $admin = $this->makeAdmin();
        $announcement = Announcement::create([
            'title' => 'To Delete', 'content' => 'Content', 'category' => 'General',
            'is_published' => true, 'posted_by' => $admin->id, 'published_at' => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/announcements/{$announcement->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('announcements', ['id' => $announcement->id]);
    }
}
