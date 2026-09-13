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
            background-color: #ffffff;
            border: 1px solid #ebebeb;
            border-radius: 16px;
            overflow: hidden;
        }

        .top-accent {
            height: 4px;
            background-color: #b71c1c;
        }

        .content {
            padding: 38px 42px 34px;
        }

        /* BRAND */
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
            line-height: 1.35;
        }

        .brand-subtitle {
            margin: 3px 0 0;
            color: #858585;
            font-size: 13px;
            line-height: 1.45;
        }

        /* HEADER */
        .eyebrow {
            margin: 0 0 9px;
            color: #b71c1c;
            font-family: 'Inter', Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
        }

        h1 {
            margin: 0 0 22px;
            color: #171717;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 29px;
            font-weight: 800;
            line-height: 1.25;
        }

        .greeting {
            margin: 0 0 6px;
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

        /* ONLY THIS ACTION AREA IS CENTERED */
        .action-area {
            margin: 27px 0 0;
            text-align: center;
        }

        .verify-button {
            display: inline-block;
            padding: 13px 26px;
            background-color: #b71c1c;
            border-radius: 999px;
            color: #ffffff !important;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 15px;
            font-weight: 700;
            line-height: 1.2;
            text-decoration: none;
        }

        .arrow {
            display: inline-block;
            margin-left: 9px;
            font-size: 18px;
            vertical-align: -1px;
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

        /* DIVIDER */
        .divider {
            width: 100%;
            margin: 34px 0 26px;
            border-collapse: collapse;
        }

        .divider-label {
            padding-right: 15px;
            color: #969696;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            white-space: nowrap;
        }

        .divider-line {
            width: 100%;
        }

        .divider-line div {
            height: 1px;
            background-color: #e5e5e5;
        }

        /* OTP HEADING STAYS LEFT */
        .otp-title {
            margin: 0 0 5px;
            color: #292929;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 18px;
            font-weight: 700;
        }

        .otp-description {
            margin: 0 0 17px;
            color: #777777;
            font-size: 14px;
            line-height: 1.6;
        }

        /* ONLY CODE + EXPIRY ARE CENTERED */
        .otp-container {
            padding: 21px 18px 18px;
            background-color: #fff8f8;
            border: 1px solid #efd4d4;
            border-radius: 12px;
            text-align: center;
        }

        .otp-boxes {
            margin: 0 auto;
            border-collapse: separate;
            border-spacing: 0;
        }

        .otp-digit {
            width: 46px;
            height: 52px;
            background-color: #ffffff;
            border: 1px solid #ead6d6;
            border-radius: 8px;
            color: #b71c1c;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 24px;
            font-weight: 800;
            text-align: center;
            vertical-align: middle;
        }

        .otp-spacer {
            width: 8px;
        }

        .code-expiry {
            margin: 14px 0 0;
            color: #777777;
            font-size: 12px;
            line-height: 1.5;
        }

        .code-expiry strong {
            color: #b71c1c;
            font-weight: 700;
        }

        /* BOTTOM */
        .bottom {
            margin-top: 32px;
            padding-top: 25px;
            border-top: 1px solid #e9e9e9;
        }

        .security {
            margin: 0 0 25px;
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

        /* FOOTER */
        .footer {
            padding: 19px 42px;
            background-color: #fafafa;
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

            .brand-name {
                font-size: 15px;
            }

            .brand-subtitle {
                font-size: 12px;
            }

            .intro {
                font-size: 14px;
            }

            .verify-button {
                padding: 13px 22px;
                font-size: 14px;
            }

            .otp-container {
                padding-left: 10px;
                padding-right: 10px;
            }

            .otp-digit {
                width: 36px;
                height: 46px;
                font-size: 21px;
            }

            .otp-spacer {
                width: 4px;
            }
        }
    </style>
</head>

<body>

    <div class="wrapper">
        <div class="card">

            <div class="top-accent"></div>

            <div class="content">

                <!-- BRAND -->
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

                <!-- EMAIL HEADER -->
                <p class="eyebrow">
                    Email Verification
                </p>

                <h1>
                    Verify your email address
                </h1>

                <p class="greeting">
                    Hi {{ $userName }},
                </p>

                <p class="intro">
                    Thank you for creating your account. Please verify your
                    email address to complete your registration and access
                    your applicant dashboard.
                </p>

                <!-- CENTERED BUTTON + LINK EXPIRY -->
                <div class="action-area">

                    <a
                        href="{{ $verificationUrl }}"
                        class="verify-button"
                    >
                        Verify Email Address
                        <span class="arrow">&rarr;</span>
                    </a>

                    <p class="link-expiry">
                        This verification link expires in
                        <strong>15 minutes.</strong>
                    </p>

                </div>

                @if($code)

                    <!-- DIVIDER -->
                    <table class="divider" role="presentation">
                        <tr>

                            <td class="divider-label">
                                OR USE VERIFICATION CODE
                            </td>

                            <td class="divider-line">
                                <div></div>
                            </td>

                        </tr>
                    </table>

                    <!-- LEFT-ALIGNED OTP HEADING -->
                    <p class="otp-title">
                        6-Digit Verification Code
                    </p>

                    <p class="otp-description">
                        Enter this code on the email verification page.
                    </p>

                    <!-- CENTERED OTP CODE + EXPIRY -->
                    <div class="otp-container">

                        <table
                            class="otp-boxes"
                            role="presentation"
                            align="center"
                        >
                            <tr>

                                @foreach(str_split((string) $code) as $digit)

                                    <td class="otp-digit">
                                        {{ $digit }}
                                    </td>

                                    @if(!$loop->last)
                                        <td class="otp-spacer"></td>
                                    @endif

                                @endforeach

                            </tr>
                        </table>

                        <p class="code-expiry">
                            Code expires in
                            <strong>15 minutes.</strong>
                        </p>

                    </div>

                @endif

                <!-- SECURITY + REGARDS STAY LEFT -->
                <div class="bottom">

                    <p class="security">
                        If you didn't create an account with SK EAS,
                        you can safely ignore this email. No action is required.
                    </p>

                    <p class="regards">
                        Regards,<br>
                        <span class="regards-name">SK Mamatid</span><br>
                        Educational Assistance System
                    </p>

                </div>

            </div>

            <div class="footer">
                This is an automated message from SK Mamatid.<br>
                Please do not reply to this email.
            </div>

        </div>
    </div>

</body>
</html>