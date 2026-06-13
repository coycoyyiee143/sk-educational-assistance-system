<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ApplicationStatusNotification extends Notification
{
    use Queueable;

    protected $status;
    protected $messageText;

    // Receive the status label and message dynamically from your controller
    public function __construct($status, $messageText)
    {
        $this->status = $status;
        $this->messageText = $messageText;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Mamatid SK Educational Assistance Application Update')
            ->greeting('Dangal Greetings!')
            ->line('There is an update regarding your application status.')
            ->line('**Current Status:** ' . $this->status)
            ->line($this->messageText)
            ->action('View Application Status', url('http://localhost:3000/ApplicantStatus'))
            ->line('Thank you for using the Sangguniang Kabataan Educational Assistance portal!');
    }
}