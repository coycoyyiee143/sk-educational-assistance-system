<?php

namespace Tests\Unit\Rules;

use App\Models\PasswordHistory;
use App\Models\User;
use App\Rules\NotRecentlyUsedPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class NotRecentlyUsedPasswordTest extends TestCase
{
    use RefreshDatabase;

    protected function fails(int $userId, string $password, int $historyLimit = 5): bool
    {
        $rule = new NotRecentlyUsedPassword($userId, $historyLimit);
        $failed = false;

        $rule->validate('password', $password, function () use (&$failed) {
            $failed = true;
        });

        return $failed;
    }

    public function test_passes_when_user_has_no_password_history()
    {
        $user = User::factory()->create();

        $this->assertFalse($this->fails($user->id, 'BrandNewPass1'));
    }

    public function test_rejects_current_password()
    {
        $user = User::factory()->create();
        PasswordHistory::create([
            'user_id'       => $user->id,
            'password_hash' => Hash::make('CurrentPass1'),
        ]);

        $this->assertTrue($this->fails($user->id, 'CurrentPass1'));
    }

    protected function makeHistoryEntry(int $userId, string $password, $createdAt): PasswordHistory
    {
        $entry = PasswordHistory::create(['user_id' => $userId, 'password_hash' => Hash::make($password)]);
        $entry->created_at = $createdAt;
        $entry->save();

        return $entry;
    }

    public function test_rejects_password_within_history_limit()
    {
        $user = User::factory()->create();
        $this->makeHistoryEntry($user->id, 'First1', now()->subMinutes(2));
        $this->makeHistoryEntry($user->id, 'Second2', now()->subMinute());

        $this->assertTrue($this->fails($user->id, 'First1'));
    }

    public function test_allows_password_not_in_history()
    {
        $user = User::factory()->create();
        PasswordHistory::create(['user_id' => $user->id, 'password_hash' => Hash::make('Old1')]);

        $this->assertFalse($this->fails($user->id, 'BrandNewPass9'));
    }

    public function test_allows_password_outside_the_configured_history_limit()
    {
        $user = User::factory()->create();

        // Oldest entry falls outside a limit of 1, so it should no longer block.
        $this->makeHistoryEntry($user->id, 'TooOld1', now()->subMinutes(2));
        $this->makeHistoryEntry($user->id, 'Newer2', now()->subMinute());

        $this->assertFalse($this->fails($user->id, 'TooOld1', historyLimit: 1));
    }

    public function test_does_not_check_another_users_history()
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();
        PasswordHistory::create(['user_id' => $userA->id, 'password_hash' => Hash::make('SharedGuess1')]);

        $this->assertFalse($this->fails($userB->id, 'SharedGuess1'));
    }
}
