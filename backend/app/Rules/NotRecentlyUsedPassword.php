<?php

namespace App\Rules;

use App\Models\PasswordHistory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Hash;

class NotRecentlyUsedPassword implements ValidationRule
{
    public function __construct(protected int $userId, protected int $historyLimit = 5) {}

    public function validate(string $attribute, mixed $value, \Closure $fail): void
    {
        $recent = PasswordHistory::where('user_id', $this->userId)
            ->latest()
            ->take($this->historyLimit)
            ->get();

        foreach ($recent as $index => $entry) {
            if (Hash::check($value, $entry->password_hash)) {
                if ($index === 0) {
                    // This IS the current password — a more specific,
                    // more useful message than "matches a recent password".
                    $fail('This is your current password. Please choose a different one.');
                } else {
                    $fail("Password can't match any of your last {$this->historyLimit} passwords.");
                }
                return;
            }
        }
    }
}