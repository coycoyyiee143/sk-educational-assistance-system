<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\ProfileController;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Unit-level coverage for the profile-completeness calculation embedded in
 * ProfileController::update() (is_profile_complete assignment, and the
 * phase/subdivision conditional requirement within it).
 *
 * This is a public controller method, so no reflection is needed — but it
 * IS invoked directly (new ProfileController(), then ->update($request))
 * with a hand-built Request and a manually-bound user resolver, never
 * through a route, the HTTP kernel, or any middleware (no putJson(),
 * no actingAs()). That is what makes this a unit test of the calculation
 * rather than a duplicate of tests/Feature/ProfileControllerTest.php's
 * test_update_recomputes_completeness_flag and
 * test_update_requires_subdivision_when_purok_type_is_phase, which already
 * cover the full HTTP+validation+auth round trip. Here we exhaustively
 * cover every individual field the AND-chain depends on, plus the two
 * fields the code comments explicitly call out as deliberately NOT
 * required (civil_status, street).
 */
class ProfileControllerCompletenessTest extends TestCase
{
    use RefreshDatabase;

    protected function callUpdate(User $user, array $data): void
    {
        $request = Request::create('/api/profile', 'PUT', $data);
        $request->setUserResolver(fn () => $user);

        (new ProfileController())->update($request);
    }

    protected function makeUserWithProfile(): User
    {
        $user = User::factory()->create(['role' => 'applicant']);
        StudentProfile::create(['user_id' => $user->id]);

        return $user;
    }

    protected function completeFields(array $overrides = []): array
    {
        return array_merge([
            'birthdate'  => '2000-01-01',
            'gender'     => 'male',
            'house_no'   => '123',
            'purok_type' => 'purok',
            'purok'      => 'Purok 1',
            'barangay'   => 'Mamatid',
            'city'       => 'Cabuyao',
            'province'   => 'Laguna',
        ], $overrides);
    }

    public function test_profile_marked_complete_when_all_core_fields_are_filled()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields());

        $this->assertTrue((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_birthdate_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['birthdate' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_gender_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['gender' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_house_no_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['house_no' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_purok_type_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['purok_type' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_purok_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['purok' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_barangay_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['barangay' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_city_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['city' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_profile_incomplete_when_province_missing()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['province' => null]));

        $this->assertFalse((bool) $user->profile->fresh()->is_profile_complete);
    }

    // NOTE: a purok_type=phase submission with subdivision missing is NOT
    // testable at this level — validateProfile()'s 'subdivision' rule is
    // required_if:purok_type,phase, so that combination throws a
    // ValidationException before the completeness calculation ever runs.
    // That scenario is already covered at the HTTP layer by
    // tests/Feature/ProfileControllerTest.php::test_update_requires_subdivision_when_purok_type_is_phase.

    public function test_profile_complete_when_purok_type_is_phase_and_subdivision_provided()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['purok_type' => 'phase', 'subdivision' => 'Greenfields']));

        $this->assertTrue((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_subdivision_not_required_when_purok_type_is_purok()
    {
        $user = $this->makeUserWithProfile();

        // purok_type is 'purok' (not 'phase') so the subdivision branch of
        // the OR condition should be short-circuited as satisfied.
        $this->callUpdate($user, $this->completeFields(['purok_type' => 'purok', 'subdivision' => null]));

        $this->assertTrue((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_civil_status_is_not_required_for_completeness()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['civil_status' => null]));

        $this->assertTrue((bool) $user->profile->fresh()->is_profile_complete);
    }

    public function test_street_is_not_required_for_completeness()
    {
        $user = $this->makeUserWithProfile();

        $this->callUpdate($user, $this->completeFields(['street' => null]));

        $this->assertTrue((bool) $user->profile->fresh()->is_profile_complete);
    }
}
