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
        2FA Reset Requested
    </h2>

    <p>
        Hello {{ $recipientFirstName }},
    </p>

    <p>
        A user got stuck at the authenticator step while logging in and asked for help resetting their 2FA:
    </p>

    <div style="
        background: #f8f8f8;
        border: 1px solid #eeeeee;
        border-radius: 10px;
        padding: 20px;
        margin: 25px 0;
    ">
        <p style="margin: 0 0 8px;"><strong>Name:</strong> {{ $requesterName }}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> {{ $requesterEmail }}</p>
        <p style="margin: 0 0 8px;"><strong>Role:</strong> {{ $requesterRole }}</p>
        <p style="margin: 0;"><strong>Requested at:</strong> {{ $requestedAt }}</p>
    </div>

    <p>
        This is only a notification, not an automatic reset — please verify this person's identity
        (e.g. a call or a face-to-face check) before resetting their 2FA from the Manage Users panel.
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
