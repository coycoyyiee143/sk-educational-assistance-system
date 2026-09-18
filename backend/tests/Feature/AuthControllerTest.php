<?php

namespace Tests\Feature;

use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use RefreshDatabase;

    // A password that passes every rule: 8+ chars, lowercase + digit,
    // not "uncompromised"-flagged, and none of NotObviouslyWeakPassword's
    // blocked terms.
    const VALID_PASSWORD = 'Xk9vRq2mZp7';

    protected function setUp(): void
    {
        parent::setUp();

        // Every password-writing endpoint in these controllers runs
        // Password::min(8)->uncompromised(), which by default calls out to
        // the real pwnedpasswords.com API. Fake it globally so tests never
        // depend on outbound network access — an empty body means "no
        // matching suffix", i.e. the password is reported as not breached.
        Http::fake([
            'api.pwnedpasswords.com/*' => Http::response('', 200),
        ]);
    }

    protected function fakeFaceServiceMatch(bool $match = true): void
    {
        Http::fake([
            'api.pwnedpasswords.com/*' => Http::response('', 200),
            '127.0.0.1:5001/*' => Http::response([
                'match'     => $match,
                'score'     => $match ? 0.92 : 0.1,
                'embedding' => array_fill(0, 128, 0.01),
            ], 200),
        ]);
    }

    protected function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name'       => 'Juan',
            'middle_name'      => 'Dela',
            'last_name'        => 'Cruz',
            'email'            => 'juan.delacruz@example.com',
            'mobile_number'    => '09171234567',
            'password'         => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
            'birthdate'        => '2000-01-15',
            'barangay'         => 'Mamatid',
            'id_image'         => UploadedFile::fake()->image('id.jpg'),
            'live_photo'       => UploadedFile::fake()->image('live.jpg'),
            'privacy_consent'  => true,
        ], $overrides);
    }

    // ── register() ──────────────────────────────────────────────

    public function test_register_creates_account_when_face_matches()
    {
        Storage::fake('local');
        Notification::fake();
        $this->fakeFaceServiceMatch(true);

        $response = $this->postJson('/api/register', $this->registrationPayload());

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'juan.delacruz@example.com',
            'role'  => 'applicant',
        ]);
        $this->assertDatabaseHas('password_histories', [
            'user_id' => User::where('email', 'juan.delacruz@example.com')->first()->id,
        ]);
    }

    public function test_registration_blocks_duplicate_email()
    {
        User::factory()->create(['email' => 'juan.delacruz@example.com']);

        $response = $this->postJson('/api/register', $this->registrationPayload());

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_registration_rejects_weak_password()
    {
        $response = $this->postJson('/api/register', $this->registrationPayload([
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_registration_blocked_when_face_does_not_match()
    {
        Storage::fake('local');
        $this->fakeFaceServiceMatch(false);

        $response = $this->postJson('/api/register', $this->registrationPayload());

        $response->assertStatus(422);
        $this->assertDatabaseMissing('users', ['email' => 'juan.delacruz@example.com']);
    }

    // ── checkDuplicate() ────────────────────────────────────────

    public function test_check_duplicate_rejects_existing_email()
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->postJson('/api/register/check', [
            'first_name' => 'Maria',
            'last_name'  => 'Santos',
            'birthdate'  => '1999-05-05',
            'email'      => 'existing@example.com',
            'password'   => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_check_duplicate_rejects_name_and_birthdate_match()
    {
        $existing = User::factory()->create([
            'first_name' => 'Maria',
            'last_name'  => 'Santos',
        ]);
        StudentProfile::create([
            'user_id'   => $existing->id,
            'birthdate' => '1999-05-05',
            'barangay'  => 'Mamatid',
        ]);

        $response = $this->postJson('/api/register/check', [
            'first_name' => 'Maria',
            'last_name'  => 'Santos',
            'birthdate'  => '1999-05-05',
            'email'      => 'new.maria@example.com',
            'password'   => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(400);
    }

    public function test_check_duplicate_passes_for_new_valid_applicant()
    {
        $response = $this->postJson('/api/register/check', [
            'first_name' => 'Pedro',
            'last_name'  => 'Reyes',
            'birthdate'  => '2001-03-20',
            'email'      => 'pedro.reyes@example.com',
            'password'   => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertOk();
    }

    // ── login() ─────────────────────────────────────────────────

    protected function makeLoginableUser(array $overrides = []): array
    {
        $plainPassword = self::VALID_PASSWORD;
        $user = User::factory()->create(array_merge([
            'password'          => bcrypt($plainPassword),
            'email_verified_at' => now(),
            'is_active'         => true,
        ], $overrides));

        return [$user, $plainPassword];
    }

    public function test_login_requires_2fa_setup_on_first_login()
    {
        [$user, $password] = $this->makeLoginableUser();

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => $password,
        ]);

        $response->assertOk();
        $response->assertJson(['requires_2fa_setup' => true]);
        $response->assertJsonStructure(['pending_token', 'qr_code_url', 'secret']);
    }

    public function test_login_requires_2fa_verification_when_already_enrolled()
    {
        $engine = new Google2FA();
        $secret = $engine->generateSecretKey();
        [$user, $password] = $this->makeLoginableUser([
            'google2fa_secret'      => encrypt($secret),
            'google2fa_enabled_at'  => now(),
        ]);

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => $password,
        ]);

        $response->assertOk();
        $response->assertJson(['requires_2fa' => true]);
        $response->assertJsonStructure(['pending_token']);
    }

    public function test_login_rejects_invalid_credentials()
    {
        [$user] = $this->makeLoginableUser();

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'totally-wrong-password',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_login_blocks_unverified_email()
    {
        [$user, $password] = $this->makeLoginableUser(['email_verified_at' => null]);

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => $password,
        ]);

        $response->assertStatus(403);
        $response->assertJson(['unverified' => true]);
    }

    public function test_login_locks_account_after_max_failed_attempts()
    {
        [$user] = $this->makeLoginableUser(['failed_login_attempts' => 2]);

        // 3rd consecutive failure trips the lockout.
        $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'wrong-password',
        ])->assertStatus(422);

        $user->refresh();
        $this->assertNotNull($user->locked_until);

        // Even a correct password is now blocked until the lockout expires.
        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(429);
    }

    public function test_login_is_throttled_after_too_many_attempts_per_minute()
    {
        for ($i = 0; $i < 10; $i++) {
            $response = $this->postJson('/api/login', [
                'email'    => 'nobody@example.com',
                'password' => 'whatever',
            ]);
            $this->assertNotEquals(429, $response->getStatusCode());
        }

        $response = $this->postJson('/api/login', [
            'email'    => 'nobody@example.com',
            'password' => 'whatever',
        ]);

        $response->assertStatus(429);
    }

    // ── verifyEmail() (link-based) ──────────────────────────────

    public function test_verify_email_activates_account_with_valid_link()
    {
        $user = User::factory()->unverified()->create([
            'verification_token'             => 'valid-token-123',
            'verification_token_expires_at'  => now()->addMinutes(30),
        ]);

        $response = $this->postJson("/api/email/verify/{$user->id}/valid-token-123");

        $response->assertOk();
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_verify_email_rejects_invalid_token()
    {
        $user = User::factory()->unverified()->create([
            'verification_token'             => 'valid-token-123',
            'verification_token_expires_at'  => now()->addMinutes(30),
        ]);

        $response = $this->postJson("/api/email/verify/{$user->id}/wrong-token");

        $response->assertStatus(400);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_verify_email_rejects_expired_link()
    {
        $user = User::factory()->unverified()->create([
            'verification_token'             => 'valid-token-123',
            'verification_token_expires_at'  => now()->subMinutes(5),
        ]);

        $response = $this->postJson("/api/email/verify/{$user->id}/valid-token-123");

        $response->assertStatus(400);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    // ── resendVerification() ────────────────────────────────────

    public function test_resend_verification_sends_new_code()
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $response = $this->postJson('/api/email/resend', ['email' => $user->email]);

        $response->assertOk();
        Notification::assertSentTo($user, \App\Notifications\CustomVerifyEmailNotification::class);
    }

    public function test_resend_verification_is_blocked_during_cooldown()
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->postJson('/api/email/resend', ['email' => $user->email])->assertOk();

        $response = $this->postJson('/api/email/resend', ['email' => $user->email]);

        $response->assertStatus(429);
    }

    // ── verifyEmailByCode() ─────────────────────────────────────

    public function test_verify_email_by_code_activates_account()
    {
        $user = User::factory()->unverified()->create([
            'verification_code'            => '123456',
            'verification_code_expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/email/verify-by-code', [
            'email' => $user->email,
            'code'  => '123456',
        ]);

        $response->assertOk();
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_verify_email_by_code_rejects_invalid_code()
    {
        $user = User::factory()->unverified()->create([
            'verification_code'            => '123456',
            'verification_code_expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/email/verify-by-code', [
            'email' => $user->email,
            'code'  => '999999',
        ]);

        $response->assertStatus(400);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    // ── confirmTwoFactorSetup() ─────────────────────────────────

    public function test_confirm_two_factor_setup_activates_2fa_and_issues_token()
    {
        [$user] = $this->makeLoginableUser();
        $engine = new Google2FA();

        $loginResponse = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => self::VALID_PASSWORD,
        ]);
        $pendingToken = $loginResponse->json('pending_token');
        $secret = $loginResponse->json('secret');
        $code = $engine->getCurrentOtp($secret);

        $response = $this->postJson('/api/2fa/setup/confirm', [
            'pending_token' => $pendingToken,
            'code'          => $code,
        ]);

        $response->assertOk();
        $response->assertJsonStructure(['token', 'user']);
        $this->assertNotNull($user->fresh()->google2fa_enabled_at);
    }

    public function test_confirm_two_factor_setup_rejects_invalid_code()
    {
        [$user] = $this->makeLoginableUser();

        $loginResponse = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => self::VALID_PASSWORD,
        ]);
        $pendingToken = $loginResponse->json('pending_token');

        $response = $this->postJson('/api/2fa/setup/confirm', [
            'pending_token' => $pendingToken,
            'code'          => '000000',
        ]);

        $response->assertStatus(422);
        $this->assertNull($user->fresh()->google2fa_enabled_at);
    }

    // ── verifyTwoFactor() ───────────────────────────────────────

    public function test_verify_two_factor_issues_token_with_correct_code()
    {
        $engine = new Google2FA();
        $secret = $engine->generateSecretKey();
        [$user] = $this->makeLoginableUser([
            'google2fa_secret'     => encrypt($secret),
            'google2fa_enabled_at' => now(),
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => self::VALID_PASSWORD,
        ]);
        $pendingToken = $loginResponse->json('pending_token');
        $code = $engine->getCurrentOtp($secret);

        $response = $this->postJson('/api/2fa/verify', [
            'pending_token' => $pendingToken,
            'code'          => $code,
        ]);

        $response->assertOk();
        $response->assertJsonStructure(['token', 'user']);
    }

    public function test_verify_two_factor_rejects_invalid_code()
    {
        $engine = new Google2FA();
        $secret = $engine->generateSecretKey();
        [$user] = $this->makeLoginableUser([
            'google2fa_secret'     => encrypt($secret),
            'google2fa_enabled_at' => now(),
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => self::VALID_PASSWORD,
        ]);
        $pendingToken = $loginResponse->json('pending_token');

        $response = $this->postJson('/api/2fa/verify', [
            'pending_token' => $pendingToken,
            'code'          => '000000',
        ]);

        $response->assertStatus(422);
    }

    // ── logout() / user() ───────────────────────────────────────

    public function test_logout_revokes_current_token()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout');

        $response->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_user_endpoint_returns_authenticated_user_with_profile()
    {
        $user = User::factory()->create();
        StudentProfile::create([
            'user_id'   => $user->id,
            'birthdate' => '2000-01-01',
            'barangay'  => 'Mamatid',
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/user');

        $response->assertOk();
        $response->assertJsonPath('id', $user->id);
        $response->assertJsonStructure(['profile']);
    }
}
