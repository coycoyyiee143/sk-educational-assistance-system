<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\ApplicationController;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Unit-level coverage for the cross-account duplicate-applicant decision
 * logic inside ApplicationController::store() — matching a new applicant
 * against any OTHER account sharing the same normalized first+last name
 * and birthdate that already has an approved/claimed application, and
 * blocking the new submission if so. Middle name is deliberately excluded
 * from the match (see the comment in store()).
 *
 * This scenario is NOT covered by tests/Feature/ApplicationControllerTest.php
 * (which only covers the same-user/same-period duplicate and the slot/period
 * gating), so it is exercised here directly against the store() method —
 * ApplicationController::store($request) is called directly, never through
 * ->postJson()/->actingAs(), bypassing the HTTP/routing/middleware layer
 * while still using real Eloquent factories/DB per the harness pattern used
 * elsewhere in tests/Unit.
 */
class ApplicationControllerDuplicateCheckTest extends TestCase
{
    use RefreshDatabase;

    protected function makeConfig(): ApplicationConfiguration
    {
        return ApplicationConfiguration::factory()->alreadyStarted()->create();
    }

    protected function makeApplicant(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'applicant'], $overrides));
    }

    protected function makeProfile(User $user, string $birthdate = '2000-01-01'): StudentProfile
    {
        return StudentProfile::create([
            'user_id'   => $user->id,
            'birthdate' => $birthdate,
        ]);
    }

    protected function callStore(User $actingUser, array $payload)
    {
        $request = Request::create('/api/applications', 'POST', $payload);
        $request->setUserResolver(fn () => $actingUser);

        return (new ApplicationController())->store($request);
    }

    protected function submitPayload(): array
    {
        return [
            'school_name'       => 'Pamantasan ng Cabuyao',
            'course'            => 'BS Information Technology',
            'year_level'        => '1st Year',
            'student_id_number' => '2026-00001',
        ];
    }

    public function test_store_blocks_new_application_when_matching_name_and_birthdate_already_received_assistance_under_another_account()
    {
        $this->makeConfig();

        $priorRecipient = $this->makeApplicant(['first_name' => 'Juan', 'last_name' => 'Delacruz']);
        $this->makeProfile($priorRecipient, '2000-05-15');
        Application::factory()->create([
            'user_id' => $priorRecipient->id,
            'status'  => 'claimed',
        ]);

        $newAccount = $this->makeApplicant(['first_name' => 'Juan', 'last_name' => 'Delacruz']);
        $this->makeProfile($newAccount, '2000-05-15');

        $response = $this->callStore($newAccount, $this->submitPayload());

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertStringContainsString(
            'already received educational assistance under a different account',
            $response->getData(true)['message']
        );
        $this->assertDatabaseCount('applications', 1); // only the prior recipient's, none created for the new account
    }

    public function test_store_matches_duplicate_case_insensitively_and_trims_whitespace()
    {
        $this->makeConfig();

        $priorRecipient = $this->makeApplicant(['first_name' => 'Maria', 'last_name' => 'Santos']);
        $this->makeProfile($priorRecipient, '1999-03-20');
        Application::factory()->create([
            'user_id' => $priorRecipient->id,
            'status'  => 'approved',
        ]);

        $newAccount = $this->makeApplicant(['first_name' => ' MARIA ', 'last_name' => ' santos ']);
        $this->makeProfile($newAccount, '1999-03-20');

        $response = $this->callStore($newAccount, $this->submitPayload());

        $this->assertEquals(400, $response->getStatusCode());
    }

    public function test_store_ignores_middle_name_when_matching_duplicates()
    {
        $this->makeConfig();

        $priorRecipient = $this->makeApplicant([
            'first_name'  => 'Jose',
            'middle_name' => 'Reyes',
            'last_name'   => 'Garcia',
        ]);
        $this->makeProfile($priorRecipient, '2001-07-01');
        Application::factory()->create([
            'user_id' => $priorRecipient->id,
            'status'  => 'approved',
        ]);

        // Different (or blank) middle name should NOT let this slip through.
        $newAccount = $this->makeApplicant([
            'first_name'  => 'Jose',
            'middle_name' => null,
            'last_name'   => 'Garcia',
        ]);
        $this->makeProfile($newAccount, '2001-07-01');

        $response = $this->callStore($newAccount, $this->submitPayload());

        $this->assertEquals(400, $response->getStatusCode());
    }

    public function test_store_allows_application_when_matching_name_and_birthdate_never_received_assistance()
    {
        $this->makeConfig();

        // Same name+birthdate exists on another account, but that account's
        // application was rejected — never approved/claimed — so it must
        // NOT block this new, otherwise-unrelated submission.
        $otherAccount = $this->makeApplicant(['first_name' => 'Ana', 'last_name' => 'Reyes']);
        $this->makeProfile($otherAccount, '2002-11-11');
        Application::factory()->create([
            'user_id' => $otherAccount->id,
            'status'  => 'rejected',
        ]);

        $newAccount = $this->makeApplicant(['first_name' => 'Ana', 'last_name' => 'Reyes']);
        $this->makeProfile($newAccount, '2002-11-11');

        $response = $this->callStore($newAccount, $this->submitPayload());

        $this->assertEquals(201, $response->getStatusCode());
        $this->assertDatabaseHas('applications', ['user_id' => $newAccount->id]);
    }

    public function test_store_allows_application_when_birthdate_differs_even_with_identical_name()
    {
        $this->makeConfig();

        $otherAccount = $this->makeApplicant(['first_name' => 'Pedro', 'last_name' => 'Cruz']);
        $this->makeProfile($otherAccount, '1995-01-01');
        Application::factory()->create([
            'user_id' => $otherAccount->id,
            'status'  => 'claimed',
        ]);

        $newAccount = $this->makeApplicant(['first_name' => 'Pedro', 'last_name' => 'Cruz']);
        $this->makeProfile($newAccount, '1998-06-06'); // different birthdate — not the same person

        $response = $this->callStore($newAccount, $this->submitPayload());

        $this->assertEquals(201, $response->getStatusCode());
    }
}
