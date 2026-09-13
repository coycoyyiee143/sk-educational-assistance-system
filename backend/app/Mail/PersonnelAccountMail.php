<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PersonnelAccountMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $firstName,
        public string $setupUrl,
        public bool $isNewAccount // true = welcome/first setup, false = admin-triggered reset
    ) {}

    public function build()
    {
        return $this->subject(
            $this->isNewAccount
                ? 'Set Up Your SK-EAS Account'
                : 'Your SK-EAS Password Was Reset'
        )
        ->view('emails.personnel-account-setup')
        ->with([
            'firstName'    => $this->firstName,
            'setupUrl'     => $this->setupUrl,
            'isNewAccount' => $this->isNewAccount,
        ]);
    }
}