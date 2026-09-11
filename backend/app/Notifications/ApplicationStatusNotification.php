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
        $statusUrl = rtrim(
            env('FRONTEND_URL', 'http://localhost:3000'),
            '/'
        ) . '/ApplicantStatus';

        return (new MailMessage)
            ->subject('Mamatid SK Educational Assistance Application Update')
            ->view('emails.application-status-update', [
                'userName' => $notifiable->first_name,
                'status' => $this->status,
                'messageText' => $this->messageText,
                'statusUrl' => $statusUrl,
            ]);
    }
}