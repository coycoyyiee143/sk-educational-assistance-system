<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $firstName,
        public string $code
    ) {}

    public function build()
    {
        return $this->subject('SK Barangay Mamatid - Password Reset Code')
            ->view('emails.password-reset-code')
            ->with([
                'firstName' => $this->firstName,
                'code'      => $this->code,
            ]);
    }
}