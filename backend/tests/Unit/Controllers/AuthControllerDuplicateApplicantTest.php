<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\AuthController;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\FaceMatchingService;
use App\Services\TwoFactorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Unit-level coverage for AuthController::findDuplicateApplicant() — the
 * name+birthdate duplicate-applicant matching rule shared by
 * checkDuplicate() and register(). Invoked directly via reflection on a
 * real controller instance (it is private), bypassing the HTTP/routing
 * layer entirely — no postJson() calls here.
 *
 * tests/Feature/AuthControllerTest.php already covers the end-to-end
 * behavior (test_check_duplicate_rejects_name_and_birthdate_match / passes
 * for new applicant) through the /api/register/check route. This file
 * isolates the matching RULE itself: exact normalization behavior
 * (trim/case-insensitivity), the AND condition between name and
 * birthdate, and the profile-join mechanics.
 */
class AuthControllerDuplicateApplicantTest extends TestCase
{
    use RefreshDatabase;

    protected function findDuplicateApplicant(string $firstName, string $lastName, string $birthdate)
    {
        $controller = new AuthController(new FaceMatchingService(), new TwoFactorService());

        $method = new ReflectionMethod(AuthController::class, 'findDuplicateApplicant');
        $method->setAccessible(true);

        return $method->invoke($controller, $firstName, $lastName, $birthdate);
    }

    protected function makeExistingApplicant(string $firstName, string $lastName, string $birthdate): User
    {
        $user = User::factory()->create([
            'first_name' => $firstName,
            'last_name'  => $lastName,
        ]);

        StudentProfile::create([
            'user_id'   => $user->id,
            'birthdate' => $birthdate,
            'barangay'  => 'Mamatid',
        ]);

        return $user;
    }

    public function test_finds_duplicate_on_exact_name_and_birthdate_match()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('Maria', 'Santos', '1999-05-05');

        $this->assertCount(1, $result);
    }

    public function test_match_is_case_insensitive()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('MARIA', 'SANTOS', '1999-05-05');

        $this->assertCount(1, $result);
    }

    public function test_match_ignores_surrounding_whitespace()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('  Maria  ', '  Santos  ', '1999-05-05');

        $this->assertCount(1, $result);
    }

    public function test_no_match_when_birthdate_differs()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('Maria', 'Santos', '2000-01-01');

        $this->assertCount(0, $result);
    }

    public function test_no_match_when_last_name_differs()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('Maria', 'Reyes', '1999-05-05');

        $this->assertCount(0, $result);
    }

    public function test_no_match_when_first_name_differs()
    {
        $this->makeExistingApplicant('Maria', 'Santos', '1999-05-05');

        $result = $this->findDuplicateApplicant('Juana', 'Santos', '1999-05-05');

        $this->assertCount(0, $result);
    }

    public function test_no_match_for_brand_new_applicant()
    {
        $result = $this->findDuplicateApplicant('Pedro', 'Reyes', '2001-03-20');

        $this->assertCount(0, $result);
    }

    public function test_no_match_when_matching_name_has_no_profile_row_with_that_birthdate()
    {
        // User exists with the right name but never completed a profile
        // (so there's no birthdate row to join against) — the whereHas
        // join means this user simply can't be matched on birthdate at all.
        User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Santos']);

        $result = $this->findDuplicateApplicant('Maria', 'Santos', '1999-05-05');

        $this->assertCount(0, $result);
    }
}
