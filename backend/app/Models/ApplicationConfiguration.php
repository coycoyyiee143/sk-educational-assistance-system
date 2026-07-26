<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use DateTimeInterface;

class ApplicationConfiguration extends Model
{
    use HasFactory;

    protected $fillable = [
        'school_year',
        'open_date',
        'close_date',
        'slot_limit',
        'slots_filled',
        'is_unlimited',
        'is_active',
        'created_by',
    ];
    protected $casts = [
        'open_date'    => 'datetime',
        'close_date'   => 'datetime',
        'is_active'    => 'boolean',
        'is_unlimited' => 'boolean',
    ];

    // Forces JSON output to use the app's configured timezone (Asia/Manila)
    // instead of converting to UTC. Without this, dates near midnight get
    // serialized to the "wrong" calendar day once converted to UTC.
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }

    public function applications()
    {
        return $this->hasMany(Application::class, 'config_id');
    }
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}