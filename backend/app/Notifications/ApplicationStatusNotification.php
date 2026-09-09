<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $status;
    protected $messageText;

    // Receive the status label and message dynamically from your controller
    public function __construct($status, $messageText)
    {
        $this->status = $status;
        $this->messageText = $messageText;
        $this->onQueue('notifications');
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Mamatid SK Educational Assistance Application Update')
            ->greeting('Good day! ' . $notifiable->first_name . ',')
            ->line('There is an update regarding your application status.')
            ->line('**Current Status:** ' . $this->status)
            ->line($this->messageText)
            ->action('View Application Status', rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/') . '/ApplicantStatus')
            ->line('Thank you for using the Sangguniang Kabataan Educational Assistance portal!')
            ->salutation("Regards,  \nSangguniang Kabataan of Barangay Mamatid");
    }
}