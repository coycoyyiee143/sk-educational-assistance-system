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
        Password Reset Request
    </h2>

    <p>
        Hello {{ $firstName }},
    </p>

    <p>
        We received a request to reset the password
        for your SK Barangay Mamatid Educational
        Assistance System account.
    </p>

    <p>
        Use the following 6-digit verification code:
    </p>

    <div style="
        background: #f8f8f8;
        border: 1px solid #eeeeee;
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        margin: 25px 0;
    ">
        <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #b71c1c;
        ">
            {{ $code }}
        </div>
    </div>

    <p>
        This code will expire in
        <strong>15 minutes</strong>.
    </p>

    <p>
        If you did not request a password reset,
        you may safely ignore this email.
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