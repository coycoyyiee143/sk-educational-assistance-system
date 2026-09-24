<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\AuthController;
use App\Models\User;
use App\Services\FaceMatchingService;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Unit-level coverage for AuthController::registerFailedAttempt() — the
 * failed-login counter/lockout decision logic. This is exercised WITHOUT
 * going through the HTTP/routing/middleware layer (no postJson()/login
 * route): the protected method is invoked directly via reflection on a
 * real controller instance, against a real User row.
 *
 * This complements (does not duplicate) tests/Feature/AuthControllerTest.php,
 * which already covers the full login() HTTP flow, including the 429
 * lockout response and the "wrong password 3x locks the account" scenario
 * at the request/response level. Here we isolate just the counting/locking
 * DECISION and its exact threshold/duration, independent of login()'s
 * password check, validation, and response shaping.
 */
class AuthControllerLockoutTest extends TestCase
{
    use RefreshDatabase;

    protected function callRegisterFailedAttempt(User $user): void
    {
        $controller = new AuthController(new FaceMatchingService(), new TwoFactorService());

        $method = new ReflectionMethod(AuthController::class, 'registerFailedAttempt');
        $method->setAccessible(true);
        $method->invoke($controller, $user);
    }

    public function test_failed_attempt_increments_counter_without_locking_below_threshold()
    {
        $user = User::factory()->create(['failed_login_attempts' => 0, 'locked_until' => null]);

        $this->callRegisterFailedAttempt($user);

        $user->refresh();
        $this->assertSame(1, $user->failed_login_attempts);
        $this->assertNull($user->locked_until);
    }

    public function test_second_failed_attempt_still_does_not_lock_account()
    {
        $user = User::factory()->create(['failed_login_attempts' => 1, 'locked_until' => null]);

        $this->callRegisterFailedAttempt($user);

        $user->refresh();
        $this->assertSame(2, $user->failed_login_attempts);
        $this->assertNull($user->locked_until);
    }

    public function test_account_locks_on_third_consecutive_failed_attempt()
    {
        $user = User::factory()->create(['failed_login_attempts' => 2, 'locked_until' => null]);

        $this->callRegisterFailedAttempt($user);

        $user->refresh();
        $this->assertNotNull($user->locked_until);
        // Counter resets once the lock is applied, so it doesn't keep
        // climbing across separate lockout windows.
        $this->assertSame(0, $user->failed_login_attempts);
    }

    public function test_lockout_duration_is_fifteen_minutes_from_now()
    {
        $this->travelTo(now());
        $user = User::factory()->create(['failed_login_attempts' => AuthController::MAX_FAILED_ATTEMPTS - 1, 'locked_until' => null]);

        $this->callRegisterFailedAttempt($user);

        $user->refresh();
        $this->assertNotNull($user->locked_until);
        // locked_until has no Eloquent cast on the User model (it isn't
        // wired into $casts), so a freshly refreshed model returns the
        // raw DB string rather than a Carbon instance — parse it explicitly.
        $this->assertEqualsWithDelta(
            now()->addMinutes(AuthController::LOCKOUT_MINUTES)->timestamp,
            \Carbon\Carbon::parse($user->locked_until)->timestamp,
            2,
            'locked_until should be exactly LOCKOUT_MINUTES from the moment the attempt was registered.'
        );
    }

    public function test_max_failed_attempts_threshold_is_three()
    {
        // Documents the exact configured threshold so a future change to
        // the constant is a deliberate, visible edit to this assertion.
        $this->assertSame(3, AuthController::MAX_FAILED_ATTEMPTS);
    }

    public function test_lockout_minutes_constant_is_fifteen()
    {
        $this->assertSame(15, AuthController::LOCKOUT_MINUTES);
    }
}
