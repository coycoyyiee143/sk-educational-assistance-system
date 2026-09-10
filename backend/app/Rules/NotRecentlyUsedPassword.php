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
            ->pluck('password_hash');

        foreach ($recent as $oldHash) {
            if (Hash::check($value, $oldHash)) {
                $fail("Password can't match any of your last {$this->historyLimit} passwords.");
                return;
            }
        }
    }
}