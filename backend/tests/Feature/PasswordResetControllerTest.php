<?php

namespace Tests\Feature;

use App\Models\PasswordHistory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetControllerTest extends TestCase
{
    use RefreshDatabase;

    const VALID_PASSWORD = 'Xk9vRq2mZp7';

    protected function setUp(): void
    {
        parent::setUp();

        // Same reasoning as AuthControllerTest: resetPassword() runs
        // Password::uncompromised(), which hits a real external API by
        // default. Fake it so the suite never depends on the network.
        Http::fake([
            'api.pwnedpasswords.com/*' => Http::response('', 200),
        ]);
    }

    protected function storeResetCode(User $user, string $code): void
    {
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->delete();

        DB::table('password_reset_tokens')->insert([
            'email'      => $user->email,
            'token'      => Hash::make($code),
            'created_at' => now(),
        ]);
    }

    // ── sendResetCode() ─────────────────────────────────────────

    public function test_send_reset_code_emails_a_code_for_existing_account()
    {
        Mail::fake();
        $user = User::factory()->create();

        $response = $this->postJson('/api/password/forgot', ['email' => $user->email]);

        $response->assertOk();
        Mail::assertSent(\App\Mail\PasswordResetCodeMail::class);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_send_reset_code_does_not_reveal_unknown_email()
    {
        Mail::fake();

        $response = $this->postJson('/api/password/forgot', ['email' => 'nobody@example.com']);

        // Same generic success message whether or not the account exists —
        // the endpoint must never leak account existence.
        $response->assertOk();
        $response->assertJson(['message' => 'If an account exists with that email address, a password reset code has been sent.']);
        Mail::assertNotSent(\App\Mail\PasswordResetCodeMail::class);
    }

    // ── verifyResetCode() ───────────────────────────────────────

    public function test_verify_reset_code_accepts_correct_code()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '654321');

        $response = $this->postJson('/api/password/verify-code', [
            'email' => $user->email,
            'code'  => '654321',
        ]);

        $response->assertOk();
    }

    public function test_verify_reset_code_rejects_incorrect_code()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '654321');

        $response = $this->postJson('/api/password/verify-code', [
            'email' => $user->email,
            'code'  => '000000',
        ]);

        $response->assertStatus(422);
    }

    public function test_verify_reset_code_rejects_expired_code()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '654321');
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->update(['created_at' => now()->subMinutes(20)]);

        $response = $this->postJson('/api/password/verify-code', [
            'email' => $user->email,
            'code'  => '654321',
        ]);

        $response->assertStatus(422);
    }

    // ── resetPassword() ─────────────────────────────────────────

    public function test_reset_password_updates_password_and_revokes_tokens()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;
        $this->storeResetCode($user, '111222');

        $response = $this->postJson('/api/password/reset', [
            'email'    => $user->email,
            'code'     => '111222',
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertOk();
        $this->assertTrue(Hash::check(self::VALID_PASSWORD, $user->fresh()->password));
        $this->assertDatabaseHas('password_histories', ['user_id' => $user->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_reset_password_rejects_weak_password()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '111222');

        $response = $this->postJson('/api/password/reset', [
            'email'    => $user->email,
            'code'     => '111222',
            'password' => 'password1',
            'password_confirmation' => 'password1',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_reset_password_rejects_reused_recent_password()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '111222');
        PasswordHistory::create([
            'user_id'       => $user->id,
            'password_hash' => Hash::make(self::VALID_PASSWORD),
        ]);

        $response = $this->postJson('/api/password/reset', [
            'email'    => $user->email,
            'code'     => '111222',
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_reset_password_rejects_expired_or_invalid_code()
    {
        $user = User::factory()->create();
        $this->storeResetCode($user, '111222');
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->update(['created_at' => now()->subMinutes(20)]);

        $response = $this->postJson('/api/password/reset', [
            'email'    => $user->email,
            'code'     => '111222',
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(422);
        $this->assertFalse(Hash::check(self::VALID_PASSWORD, $user->fresh()->password));
    }
}
