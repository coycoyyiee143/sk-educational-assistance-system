<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PersonnelSetupControllerTest extends TestCase
{
    use RefreshDatabase;

    const VALID_PASSWORD = 'Xk9vRq2mZp7';

    protected function setUp(): void
    {
        parent::setUp();

        // store() runs Password::uncompromised(); fake the external API
        // so the test never depends on network access.
        Http::fake([
            'api.pwnedpasswords.com/*' => Http::response('', 200),
        ]);
    }

    protected function makePersonnelWithToken(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role'                           => 'sk_verifier',
            'email_verified_at'              => null,
            'verification_token'             => 'setup-token-123',
            'verification_token_expires_at'  => now()->addHours(24),
        ], $overrides));
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_returns_account_details_for_valid_token()
    {
        $user = $this->makePersonnelWithToken();

        $response = $this->getJson('/api/personnel/setup/setup-token-123');

        $response->assertOk();
        $response->assertJson([
            'first_name' => $user->first_name,
            'email'      => $user->email,
        ]);
    }

    public function test_show_rejects_invalid_token()
    {
        $this->makePersonnelWithToken();

        $response = $this->getJson('/api/personnel/setup/not-the-real-token');

        $response->assertStatus(400);
    }

    public function test_show_rejects_expired_token()
    {
        $this->makePersonnelWithToken([
            'verification_token_expires_at' => now()->subHour(),
        ]);

        $response = $this->getJson('/api/personnel/setup/setup-token-123');

        $response->assertStatus(400);
    }

    // ── store() ─────────────────────────────────────────────────

    public function test_store_activates_account_with_valid_token_and_password()
    {
        $user = $this->makePersonnelWithToken();

        $response = $this->postJson('/api/personnel/setup/setup-token-123', [
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check(self::VALID_PASSWORD, $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->verification_token);
        $this->assertDatabaseHas('password_histories', ['user_id' => $user->id]);
    }

    public function test_store_rejects_expired_token()
    {
        $user = $this->makePersonnelWithToken([
            'verification_token_expires_at' => now()->subHour(),
        ]);

        $response = $this->postJson('/api/personnel/setup/setup-token-123', [
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(400);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_store_rejects_weak_password()
    {
        $this->makePersonnelWithToken();

        $response = $this->postJson('/api/personnel/setup/setup-token-123', [
            'password' => 'admin1234',
            'password_confirmation' => 'admin1234',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_store_rejects_password_confirmation_mismatch()
    {
        $this->makePersonnelWithToken();

        $response = $this->postJson('/api/personnel/setup/setup-token-123', [
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => 'SomethingElse9',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }
}
