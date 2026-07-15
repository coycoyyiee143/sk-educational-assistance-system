<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class CustomVerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $verificationUrl;

    public function __construct($verificationUrl)
    {
        $this->verificationUrl = $verificationUrl;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Verify Your Educational Assistance Account')
            ->greeting('Good day! ' . $notifiable->first_name . ',')
            ->line('Thank you for registering. Please verify your email address to complete your application profile.')
            ->action('Verify Email Address', $this->verificationUrl)
            ->line('If you did not create an account, no further action is required.')
            ->salutation("Regards,  \nSangguniang Kabataan of Barangay Mamatid");
    }
}