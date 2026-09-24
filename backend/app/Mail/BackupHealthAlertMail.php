<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BackupHealthAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientFirstName,
        public string $reason
    ) {}

    public function build()
    {
        return $this->subject('SK-EAS Backup Alert — Action Needed')
            ->view('emails.backup-health-alert')
            ->with([
                'recipientFirstName' => $this->recipientFirstName,
                'reason'             => $this->reason,
            ]);
    }
}
