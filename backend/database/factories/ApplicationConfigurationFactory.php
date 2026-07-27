<?php
namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ApplicationConfigurationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'school_year'  => '2025-2026',
            'open_date'    => now()->subDays(1)->startOfDay(),
            'close_date'   => now()->addDays(13)->endOfDay(),
            'slot_limit'   => 100,
            'slots_filled' => 0,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => User::factory()->create(['role' => 'sk_admin'])->id,
        ];
    }

    // Convenience states for your checklist scenarios:
    public function notYetStarted(): static
    {
        return $this->state(fn () => [
            'open_date'  => now()->addDays(5)->startOfDay(),
            'close_date' => now()->addDays(20)->endOfDay(),
        ]);
    }

    public function alreadyStarted(): static
    {
        return $this->state(fn () => [
            'open_date'  => now()->subDays(5)->startOfDay(),
            'close_date' => now()->addDays(10)->endOfDay(),
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn () => [
            'open_date'  => now()->subDays(10)->startOfDay(),
            'close_date' => now()->subDay()->endOfDay(),
        ]);
    }

    public function atCapacity(): static
    {
        return $this->state(fn () => [
            'slot_limit'   => 10,
            'slots_filled' => 10,
        ]);
    }

    public function almostFull(): static
    {
        return $this->state(fn () => [
            'slot_limit'   => 10,
            'slots_filled' => 9,
        ]);
    }
}