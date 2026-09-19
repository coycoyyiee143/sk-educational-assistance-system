<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TwoFactorResetRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientFirstName,
        public string $requesterName,
        public string $requesterEmail,
        public string $requesterRole,
        public string $requestedAt
    ) {}

    public function build()
    {
        return $this->subject('2FA Reset Requested — Identity Verification Needed')
            ->view('emails.two-factor-reset-request')
            ->with([
                'recipientFirstName' => $this->recipientFirstName,
                'requesterName'      => $this->requesterName,
                'requesterEmail'     => $this->requesterEmail,
                'requesterRole'      => $this->requesterRole,
                'requestedAt'        => $this->requestedAt,
            ]);
    }
}
