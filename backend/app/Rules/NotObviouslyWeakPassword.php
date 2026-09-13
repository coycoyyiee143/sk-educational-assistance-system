<?php

namespace App\Rules;

use Illuminate\Contracts\Validation\ValidationRule;

class NotObviouslyWeakPassword implements ValidationRule
{
    // Context-specific + generically obvious terms — not from a breach
    // corpus, just things nobody should be able to build a password
    // around for this particular system. Checked as substrings,
    // case-insensitively, so "Admin123!" is still caught.
    protected array $blockedTerms = [
        'admin', 'administrator', 'password', 'passw0rd',
        'sk', 'skmamatid', 'mamatid', 'barangay',
        'applicant', 'verifier', 'welcome', 'letmein',
        'qwerty', 'changeme', 'test123',
    ];

    public function validate(string $attribute, mixed $value, \Closure $fail): void
    {
        $lower = strtolower($value);

        foreach ($this->blockedTerms as $term) {
            if (str_contains($lower, $term)) {
                $fail('This password is too easy to guess. Please avoid common words like "admin" or "password".');
                return;
            }
        }
    }
}