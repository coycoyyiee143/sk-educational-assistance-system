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
    protected $assignment;

    public function __construct($application, $lane, $schedule, $assignment = null)
    {
        $this->application = $application;
        $this->lane         = $lane;
        $this->schedule     = $schedule;
        $this->assignment   = $assignment;
        $this->onQueue('notifications');
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $isGracePeriod = $this->assignment?->source === 'waitlist_promotion';

        if ($isGracePeriod) {
            $startDate = Carbon::parse($this->schedule->grace_period_date)->format('F j');
            $endDate = $this->schedule->grace_period_end_date
                ? Carbon::parse($this->schedule->grace_period_end_date)->format('F j, Y')
                : null;

            $windowText = $endDate
                ? "any weekday from {$startDate} to {$endDate}"
                : "starting {$startDate}";

            return (new MailMessage)
                ->subject('Your Claiming Schedule Has Been Released')
                ->greeting('Good day! ' . $notifiable->first_name . ',')
                ->line('A slot has opened up and your educational assistance application has now been approved.')
                ->line('**Control Number:** ' . $this->application->control_number)
                ->line('**Claiming Window:** ' . $windowText . ', during regular office hours.')
                ->line('**Venue:** ' . $this->schedule->location)
                ->action('View Claiming Schedule', url('http://localhost:3000/ApplicantClaimingSchedule'))
                ->line('Please bring valid identification and the original copies of your submitted documents.')
                ->salutation("Regards,  \nSangguniang Kabataan of Barangay Mamatid");
        }

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