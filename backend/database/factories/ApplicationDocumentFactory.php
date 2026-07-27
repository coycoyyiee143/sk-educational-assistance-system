<?php

namespace Database\Factories;

use App\Models\Application;
use Illuminate\Database\Eloquent\Factories\Factory;

class ApplicationDocumentFactory extends Factory
{
    public function definition(): array
    {
        $type = fake()->randomElement(['registration_form', 'school_id', 'voters_certificate']);

        return [
            'application_id' => Application::factory(),
            'document_type'  => $type,
            'file_path'      => "documents/test/{$type}_" . fake()->uuid() . '.jpg',
            'file_name'      => "{$type}.jpg",
            'mime_type'      => 'image/jpeg',
            'version'        => 1,
            'status'         => 'processed',
        ];
    }
}