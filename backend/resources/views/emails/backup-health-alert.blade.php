<div style="
    font-family: Arial, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 30px;
    color: #333333;
">
    <h2 style="
        color: #b71c1c;
        margin-bottom: 10px;
    ">
        Backup Alert
    </h2>

    <p>
        Hello {{ $recipientFirstName }},
    </p>

    <p>
        The scheduled SK-EAS backup job needs attention:
    </p>

    <div style="
        background: #f8f8f8;
        border: 1px solid #eeeeee;
        border-radius: 10px;
        padding: 20px;
        margin: 25px 0;
    ">
        <p style="margin: 0;">{{ $reason }}</p>
    </div>

    <p>
        Check the server's cron job and <code>/var/log/sk-eas-backup.log</code>, or see
        <strong>BACKUP.md</strong> for troubleshooting steps. You'll only get this alert once
        per outage — it won't repeat until backups are healthy again.
    </p>

    <p style="text-align: center; margin: 25px 0;">
        <a href="{{ rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/') }}/AdminSystemMaintenance" style="
            background: #b71c1c;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            display: inline-block;
            font-weight: bold;
        ">
            View System Maintenance
        </a>
    </p>

    <hr style="
        border: none;
        border-top: 1px solid #eeeeee;
        margin: 30px 0 20px;
    ">

    <p style="
        color: #888888;
        font-size: 12px;
    ">
        SK Barangay Mamatid<br>
        Educational Assistance System
    </p>
</div>
