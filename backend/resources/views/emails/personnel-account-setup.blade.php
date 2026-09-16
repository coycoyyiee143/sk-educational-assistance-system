<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        body {
            margin: 0;
            padding: 0;
            background-color: #f6f6f7;
            font-family: 'Inter', Arial, sans-serif;
            color: #222222;
        }

        .wrapper {
            width: 100%;
            padding: 38px 16px;
            box-sizing: border-box;
        }

        .card {
            width: 100%;
            max-width: 580px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #ebebeb;
            border-radius: 16px;
            overflow: hidden;
        }

        .top-accent {
            height: 4px;
            background: #b71c1c;
        }

        .content {
            padding: 38px 42px 34px;
        }

        .brand {
            display: table;
            width: 100%;
            margin-bottom: 34px;
        }

        .brand-logo-wrap,
        .brand-text {
            display: table-cell;
            vertical-align: middle;
        }

        .brand-logo-wrap {
            width: 54px;
        }

        .logo {
            display: block;
            width: 48px;
            height: 48px;
            object-fit: cover;
            border-radius: 50%;
        }

        .brand-text {
            padding-left: 12px;
        }

        .brand-name {
            margin: 0;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            color: #222222;
            font-size: 16px;
            font-weight: 700;
        }

        .brand-subtitle {
            margin: 3px 0 0;
            color: #858585;
            font-size: 13px;
        }

        .eyebrow {
            margin: 0 0 9px;
            color: #b71c1c;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.1px;
            text-transform: uppercase;
        }

        h1 {
            margin: 0 0 18px;
            color: #171717;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 28px;
            font-weight: 800;
            line-height: 1.25;
        }

        .greeting {
            margin: 0 0 10px;
            color: #333333;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 17px;
            font-weight: 700;
        }

        .intro {
            margin: 0;
            color: #5f6368;
            font-size: 15px;
            line-height: 1.7;
        }

        .action-area {
            margin: 28px 0 0;
            text-align: center;
        }

        .setup-button {
            display: inline-block;
            padding: 13px 26px;
            background-color: #b71c1c;
            border-radius: 999px;
            color: #ffffff !important;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 15px;
            font-weight: 700;
            text-decoration: none;
        }

        .arrow {
            margin-left: 8px;
            font-size: 18px;
        }

        .link-expiry {
            margin: 11px 0 0;
            color: #888888;
            font-size: 12px;
            line-height: 1.5;
        }

        .link-expiry strong {
            color: #555555;
            font-weight: 700;
        }

        .bottom {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #eeeeee;
        }

        .security {
            margin: 0 0 24px;
            color: #747474;
            font-size: 13px;
            line-height: 1.7;
        }

        .regards {
            margin: 0;
            color: #555555;
            font-size: 14px;
            line-height: 1.6;
        }

        .regards-name {
            color: #b71c1c;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 16px;
            font-weight: 700;
        }

        .footer {
            padding: 18px 42px;
            background: #fafafa;
            border-top: 1px solid #eeeeee;
            color: #999999;
            font-size: 11px;
            line-height: 1.6;
        }

        @media only screen and (max-width: 600px) {
            .wrapper {
                padding: 16px 10px;
            }

            .content {
                padding: 30px 22px;
            }

            .footer {
                padding: 18px 22px;
            }

            h1 {
                font-size: 25px;
            }

            .intro {
                font-size: 14px;
            }

            .setup-button {
                padding: 13px 22px;
                font-size: 14px;
            }
        }
    </style>
</head>

<body>

<div class="wrapper">
    <div class="card">

        <div class="top-accent"></div>

        <div class="content">

            <div class="brand">

                <div class="brand-logo-wrap">
                    <img
                        src="{{ $message->embed(public_path('icons/sk-logo.jpg')) }}"
                        alt="SK Mamatid"
                        class="logo"
                    >
                </div>

                <div class="brand-text">
                    <p class="brand-name">
                        SK Educational Assistance System
                    </p>

                    <p class="brand-subtitle">
                        Sangguniang Kabataan ng Barangay Mamatid
                    </p>
                </div>

            </div>

            <p class="eyebrow">
                {{ $isNewAccount ? 'Account Setup' : 'Password Reset' }}
            </p>

            <h1>
                {{ $isNewAccount ? 'Set up your SK-EAS account' : 'Your SK-EAS password was reset' }}
            </h1>

            <p class="greeting">
                Hi {{ $firstName }},
            </p>

            <p class="intro">
                @if ($isNewAccount)
                    An SK-EAS personnel account has been created for you. Click the
                    button below to set your password and activate your account.
                @else
                    Your SK-EAS password has been reset by an administrator. Click
                    the button below to set a new password.
                @endif
            </p>

            <div class="action-area">

                <a href="{{ $setupUrl }}" class="setup-button">
                    {{ $isNewAccount ? 'Set My Password' : 'Reset My Password' }}
                    <span class="arrow">&rarr;</span>
                </a>

                <p class="link-expiry">
                    This link expires in <strong>3 days</strong> and can only be used once.
                </p>

            </div>

            <div class="bottom">

                <p class="security">
                    If you didn't expect this email, please contact your SK admin
                    immediately.
                </p>

                <p class="regards">
                    Regards,<br>
                    <span class="regards-name">SK Mamatid</span><br>
                    Educational Assistance System
                </p>

            </div>

        </div>

        <div class="footer">
            © {{ date('Y') }} Sangguniang Kabataan ng Barangay Mamatid.<br>
            This is an automated message. Please do not reply to this email.
        </div>

    </div>
</div>

</body>
</html>
