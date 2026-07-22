<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;
use Carbon\Carbon;

class ClaimingScheduleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $application;
    protected $lane;
    protected $schedule;

    public function __construct($application, $lane, $schedule)
    {
        $this->application = $application;
        $this->lane         = $lane;
        $this->schedule     = $schedule;
        $this->onQueue('notifications');
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
            ->subject('Your Claiming Schedule Has Been Released')
            ->greeting('Good day! ' . $notifiable->first_name . ',')
            ->line('Your educational assistance application has been approved and your claiming schedule is now available.')
            ->line('**Control Number:** ' . $this->application->control_number)
            ->line('**Claiming Date:** ' . Carbon::parse($this->lane->claiming_date)->format('F j, Y'))
            ->line('**Batch Time:** ' . ucfirst($this->lane->batch) . ' (' . $batchTime . ')')
            ->line('**Lane:** ' . $this->lane->lane_name)
            ->line('**Venue:** ' . $this->schedule->location)
            ->action('View Claiming Schedule', url('http://localhost:3000/ApplicantClaimingSchedule'))
            ->line('Please bring valid identification and the original copies of your submitted documents.')
            ->salutation("Regards,  \nSangguniang Kabataan of Barangay Mamatid");
    }
}