<?php
namespace Database\Factories;

use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ApplicationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id'           => User::factory()->create(['role' => 'applicant'])->id,
            'config_id'         => ApplicationConfiguration::factory(),
            'school_name'       => 'Pamantasan ng Cabuyao',
            'school_address'    => null,
            'course'            => 'BS Information Technology',
            'year_level'        => '3rd Year',
            'student_id_number' => '2023-00123',
            'status'            => 'pending_prescreening',
            'submitted_at'      => now(),
        ];
    }
}