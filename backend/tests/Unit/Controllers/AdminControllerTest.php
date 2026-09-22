<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\AdminController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Unit-level coverage for the pure business-rule decisions inside
 * AdminController::resetPassword() / resetTwoFactor() / toggleStatus() —
 * the "you can't act on your own account this way" self-block, the
 * role-restriction on password resets, and the is_active flip — exercised
 * by calling the controller methods directly (with a manually built
 * Request carrying a fake authenticated user via setUserResolver()),
 * WITHOUT going through routing, Sanctum auth middleware, or
 * ->postJson()/->actingAs().
 *
 * Complements (does not duplicate) tests/Feature/AdminControllerTest.php,
 * which already covers these same endpoints at the full HTTP level
 * (including the 403/401 authorization gate and the JSON response shape).
 * AdminController has no login-lockout math of its own (that lives in
 * AuthController, covered separately by AuthControllerLockoutTest) and its
 * activity-log endpoints are plain query filters with no isolatable
 * calculation — so this file is intentionally narrow.
 */
class AdminControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function controller(): AdminController
    {
        return new AdminController();
    }

    protected function requestAs(User $actingUser): Request
    {
        $request = Request::create('/', 'POST');
        $request->setUserResolver(fn () => $actingUser);

        return $request;
    }

    // ── resetPassword() — self-block ─────────────────────────────────

    public function test_reset_password_blocks_an_admin_from_resetting_their_own_account()
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'sk_admin']);

        $response = $this->controller()->resetPassword($this->requestAs($admin), $admin->id);

        $this->assertEquals(422, $response->getStatusCode());
        Mail::assertNothingSent();
    }

    public function test_reset_password_allows_an_admin_to_reset_a_different_verifiers_account()
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->controller()->resetPassword($this->requestAs($admin), $verifier->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNotNull($verifier->fresh()->verification_token);
    }

    // ── resetPassword() — role restriction ───────────────────────────

    public function test_reset_password_rejects_an_applicant_account()
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $applicant = User::factory()->create(['role' => 'applicant']);

        $response = $this->controller()->resetPassword($this->requestAs($admin), $applicant->id);

        $this->assertEquals(422, $response->getStatusCode());
    }

    public function test_reset_password_clears_the_lockout_state_on_the_target_account()
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $verifier = User::factory()->create([
            'role'                   => 'sk_verifier',
            'failed_login_attempts'  => 3,
            'locked_until'           => now()->addMinutes(15),
        ]);

        $this->controller()->resetPassword($this->requestAs($admin), $verifier->id);

        $fresh = $verifier->fresh();
        $this->assertEquals(0, $fresh->failed_login_attempts);
        $this->assertNull($fresh->locked_until);
    }

    // ── resetTwoFactor() — self-block ────────────────────────────────

    public function test_reset_two_factor_blocks_an_admin_from_resetting_their_own_2fa()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $admin->forceFill(['google2fa_secret' => 'SECRET', 'google2fa_enabled_at' => now()])->save();

        $response = $this->controller()->resetTwoFactor($this->requestAs($admin), $admin->id);

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertNotNull($admin->fresh()->google2fa_secret);
    }

    public function test_reset_two_factor_allows_an_admin_to_reset_a_different_users_2fa_regardless_of_role()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $applicant = User::factory()->create(['role' => 'applicant']);
        $applicant->forceFill(['google2fa_secret' => 'SECRET', 'google2fa_enabled_at' => now()])->save();

        $response = $this->controller()->resetTwoFactor($this->requestAs($admin), $applicant->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNull($applicant->fresh()->google2fa_secret);
        $this->assertNull($applicant->fresh()->google2fa_enabled_at);
    }

    // ── toggleStatus() ────────────────────────────────────────────────

    public function test_toggle_status_deactivates_an_active_account()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier', 'is_active' => true]);

        $response = $this->controller()->toggleStatus($verifier->id);

        $this->assertFalse($response->getData(true)['is_active']);
        $this->assertFalse($verifier->fresh()->is_active);
    }

    public function test_toggle_status_reactivates_a_deactivated_account()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier', 'is_active' => false]);

        $response = $this->controller()->toggleStatus($verifier->id);

        $this->assertTrue($response->getData(true)['is_active']);
        $this->assertTrue($verifier->fresh()->is_active);
    }
}
