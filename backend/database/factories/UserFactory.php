<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'first_name'        => fake()->firstName(),
            'middle_name'       => fake()->lastName(),
            'last_name'         => fake()->lastName(),
            'email'             => fake()->unique()->safeEmail(),
            'mobile_number'     => '09' . fake()->unique()->numerify('#########'),
            'password'          => static::$password ??= Hash::make('password'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
            'remember_token'    => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Convenience states for the three roles in your system.
     */
    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'sk_admin']);
    }

    public function verifier(): static
    {
        return $this->state(fn () => ['role' => 'sk_verifier']);
    }

    public function applicant(): static
    {
        return $this->state(fn () => ['role' => 'applicant']);
    }
}