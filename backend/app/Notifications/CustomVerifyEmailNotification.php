<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class CustomVerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $verificationUrl;
    protected $code;

    public function __construct($verificationUrl, $code = null)
    {
        $this->verificationUrl = $verificationUrl;
        $this->code = $code;
        $this->onQueue('notifications');
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Verify Your Educational Assistance Account')
            ->view('emails.verify-email', [
                'userName'        => $notifiable->first_name,
                'verificationUrl' => $this->verificationUrl,
                'code'            => $this->code,
            ]);
    }
}