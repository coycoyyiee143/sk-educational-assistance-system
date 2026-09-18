<?php

namespace Tests\Unit\Rules;

use App\Rules\NotObviouslyWeakPassword;
use Tests\TestCase;

class NotObviouslyWeakPasswordTest extends TestCase
{
    protected function fails(string $password): bool
    {
        $rule = new NotObviouslyWeakPassword();
        $failed = false;

        $rule->validate('password', $password, function () use (&$failed) {
            $failed = true;
        });

        return $failed;
    }

    public function test_rejects_password_containing_admin()
    {
        $this->assertTrue($this->fails('Admin123!'));
    }

    public function test_rejects_password_containing_barangay_name()
    {
        $this->assertTrue($this->fails('Mamatid2026!'));
    }

    public function test_rejects_password_containing_system_abbreviation()
    {
        $this->assertTrue($this->fails('SkMamatid2026'));
    }

    public function test_check_is_case_insensitive()
    {
        $this->assertTrue($this->fails('PASSWORD1!'));
    }

    public function test_matches_blocked_term_as_substring()
    {
        $this->assertTrue($this->fails('myqwertykeyboard1'));
    }

    public function test_allows_password_without_any_blocked_term()
    {
        $this->assertFalse($this->fails('Xk9!vRq2mZp7'));
    }
}
