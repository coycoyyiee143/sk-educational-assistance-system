<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f4f4f7;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 480px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        h1 {
            font-size: 22px;
            color: #1a1a1a;
            margin: 0 0 16px;
        }
        p {
            font-size: 15px;
            line-height: 1.6;
            margin: 0 0 20px;
        }
        .intro {
            color: #444;
        }
        .btn-wrapper {
            text-align: center;
            margin: 24px 0;
        }
        .btn {
            display: inline-block;
            background-color: #b71c1c;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 600;
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 15px;
        }
        .code-box {
            background-color: #f3f0fb;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            margin: 24px 0;
        }
        .code-box .label {
            color: #6d5bd0;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .code-box .code {
            color: #b71c1c;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 4px;
            margin: 8px 0;
        }
        .code-box .expiry {
            color: #888;
            font-size: 12px;
        }
        .footer-note {
            color: #999;
            font-size: 13px;
            font-style: italic;
            margin-top: 24px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="{{ $message->embed(public_path('sk-logo.jpg')) }}" alt="SK Barangay Mamatid" style="width: 64px; height: 64px; border-radius: 50%;">
        </div>

        <h1>Good day! {{ $userName }},</h1>
        <p class="intro">
            Thank you for registering. Please verify your email address to complete your application profile and access your secure dashboard.
        </p>

        <div class="btn-wrapper">
            <a href="{{ $verificationUrl }}" class="btn">Verify Email Address</a>
        </div>

        @if($code)
        <div class="code-box">
            <div class="label">Use code for verification:</div>
            <div class="code">{{ $code }}</div>
            <div class="expiry">Expires in 15 minutes</div>
        </div>
        @endif

        <p class="footer-note">
            If you did not create an account, no further action is required. This link will safely expire.
        </p>
    </div>
</body>
</html>