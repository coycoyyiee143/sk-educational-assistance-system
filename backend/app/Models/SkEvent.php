<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SkEvent extends Model
{
    protected $fillable = [
        'title',
        'description',
        'event_date',
        'event_time',
        'venue',
        'image_path',
        'is_published',
        'posted_by',
    ];

    protected $casts = [
        'event_date' => 'date',
        'is_published' => 'boolean',
    ];

    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }
}