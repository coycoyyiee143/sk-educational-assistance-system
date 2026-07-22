<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Carbon\Carbon;

class ClaimingReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $application;
    protected $lane;
    protected $schedule;

    public $queue = 'notifications';

    public function __construct($application, $lane, $schedule)
    {
        $this->application = $application;
        $this->lane         = $lane;
        $this->schedule     = $schedule;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $batchTime = $this->lane->batch === 'morning'
            ? substr($this->schedule->morning_start, 0, 5) . ' - ' . substr($this->schedule->morning_end, 0, 5)
            : substr($this->schedule->afternoon_start, 0, 5) . ' - ' . substr($this->schedule->afternoon_end, 0, 5);

        return (new MailMessage)
            ->subject('Reminder: Claiming Day is Tomorrow')
            ->greeting('Dangal Greetings ' . $notifiable->first_name . ',')
            ->line('This is a reminder that your claiming schedule is tomorrow.')
            ->line('**Control Number:** ' . $this->application->control_number)
            ->line('**Claiming Date:** ' . Carbon::parse($this->lane->claiming_date)->format('F j, Y'))
            ->line('**Batch Time:** ' . ucfirst($this->lane->batch) . ' (' . $batchTime . ')')
            ->line('**Lane:** ' . $this->lane->lane_name)
            ->line('**Venue:** ' . $this->schedule->location)
            ->line('Please bring valid identification and the original copies of your submitted documents.')
            ->line('If you are unable to claim on your assigned date, please coordinate with the SK office regarding the grace period.');
    }
}