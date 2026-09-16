<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorServiceTest extends TestCase
{
    use RefreshDatabase;

    protected TwoFactorService $service;
    protected Google2FA $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new TwoFactorService();
        $this->engine = new Google2FA();
    }

    public function test_generate_secret_returns_a_usable_base32_secret()
    {
        $secret = $this->service->generateSecret();

        $this->assertNotEmpty($secret);
        // Valid base32 secrets only ever produce a real OTP if well-formed;
        // this throws if generateSecret() produced garbage.
        $this->engine->getCurrentOtp($secret);
        $this->addToAssertionCount(1);
    }

    public function test_get_qr_code_url_embeds_issuer_and_user_email()
    {
        $user = User::factory()->create(['email' => 'applicant@example.com']);
        $secret = $this->service->generateSecret();

        $url = $this->service->getQrCodeUrl($user, $secret);

        $this->assertStringContainsString('Mamatid%20SK-EAS', $url);
        $this->assertStringContainsString('applicant%40example.com', $url);
    }

    public function test_confirm_setup_activates_2fa_with_correct_code()
    {
        $user = User::factory()->create();
        $secret = $this->service->generateSecret();
        $code = $this->engine->getCurrentOtp($secret);

        $result = $this->service->confirmSetup($user, $secret, $code);

        $this->assertTrue($result);
        $this->assertNotNull($user->fresh()->google2fa_secret);
        $this->assertNotNull($user->fresh()->google2fa_enabled_at);
    }

    public function test_confirm_setup_rejects_wrong_code()
    {
        $user = User::factory()->create();
        $secret = $this->service->generateSecret();

        $result = $this->service->confirmSetup($user, $secret, '000000');

        $this->assertFalse($result);
        $this->assertNull($user->fresh()->google2fa_secret);
    }

    public function test_verify_returns_false_when_2fa_not_enabled()
    {
        $user = User::factory()->create(['google2fa_secret' => null]);

        $this->assertFalse($this->service->verify($user, '123456'));
    }

    public function test_verify_accepts_correct_code_for_enabled_user()
    {
        $user = User::factory()->create();
        $secret = $this->service->generateSecret();
        $code = $this->engine->getCurrentOtp($secret);
        $this->service->confirmSetup($user, $secret, $code);

        $freshUser = $user->fresh();
        $freshCode = $this->engine->getCurrentOtp($secret);

        $this->assertTrue($this->service->verify($freshUser, $freshCode));
    }

    public function test_verify_rejects_incorrect_code_for_enabled_user()
    {
        $user = User::factory()->create();
        $secret = $this->service->generateSecret();
        $code = $this->engine->getCurrentOtp($secret);
        $this->service->confirmSetup($user, $secret, $code);

        $this->assertFalse($this->service->verify($user->fresh(), '000000'));
    }
}
