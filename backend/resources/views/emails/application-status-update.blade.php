@php
    $normalizedStatus = strtolower(str_replace([' ', '-'], '_', $status));

    $statusClass = match ($normalizedStatus) {
        'approved', 'claimed' =>
            'status-success',

        'pending',
        'pending_prescreening',
        'for_review' =>
            'status-info',

        'reupload_requested',
        're_upload_requested',
        'unclaimed' =>
            'status-warning',

        'waitlisted' =>
            'status-waitlist',

        'rejected',
        'not_cleared',
        'not_selected' =>
            'status-danger',

        default =>
            'status-neutral',
    };
@endphp

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

        .intro,
        .message {
            margin: 0;
            color: #5f6368;
            font-size: 15px;
            line-height: 1.7;
        }

        .status-box {
            margin: 22px 0;
            padding: 16px 18px;
            border: 1px solid;
            border-radius: 10px;
        }

        .status-label {
            margin: 0 0 5px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-value {
            margin: 0;
            font-family: 'Hanken Grotesk', Arial, sans-serif;
            font-size: 18px;
            font-weight: 700;
        }

        .status-info {
            background: #f5f9ff;
            border-color: #cfe0f7;
        }

        .status-info .status-label {
            color: #71839b;
        }

        .status-info .status-value {
            color: #2563a9;
        }

        .status-success {
            background: #f3fbf6;
            border-color: #c8e8d2;
        }

        .status-success .status-label {
            color: #71877a;
        }

        .status-success .status-value {
            color: #21864b;
        }

        .status-warning {
            background: #fff8f1;
            border-color: #f1d5b8;
        }

        .status-warning .status-label {
            color: #91785f;
        }

        .status-warning .status-value {
            color: #c56a16;
        }

        .status-waitlist {
            background: #fffbeb;
            border-color: #eadca8;
        }

        .status-waitlist .status-label {
            color: #8b805e;
        }

        .status-waitlist .status-value {
            color: #a87900;
        }

        .status-danger {
            background: #fff5f5;
            border-color: #efcccc;
        }

        .status-danger .status-label {
            color: #927070;
        }

        .status-danger .status-value {
            color: #b42323;
        }

        .status-neutral {
            background: #f7f7f7;
            border-color: #dddddd;
        }

        .status-neutral .status-label {
            color: #888888;
        }

        .status-neutral .status-value {
            color: #555555;
        }

        .action-area {
            margin: 28px 0 0;
            text-align: center;
        }

        .status-button {
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

        .bottom {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #eeeeee;
        }

        .thanks {
            margin: 0 0 24px;
            color: #777777;
            font-size: 13px;
            line-height: 1.65;
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

            .intro,
            .message {
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
                Application Update
            </p>

            <h1>
                Application status update
            </h1>

            <p class="greeting">
                Good day, {{ $userName }}!
            </p>

            <p class="intro">
                There is an update regarding your educational assistance application.
            </p>

            <div class="status-box {{ $statusClass }}">

                <p class="status-label">
                    Current Status
                </p>

                <p class="status-value">
                    {{ $status }}
                </p>

            </div>

            <p class="message">
                {{ $messageText }}
            </p>

            <div class="action-area">

                <a href="{{ $statusUrl }}" class="status-button">
                    View Application Status
                    <span class="arrow">&rarr;</span>
                </a>

            </div>

            <div class="bottom">

                <p class="thanks">
                    Thank you for using the SK Educational Assistance System.
                    You can check your dashboard anytime for the latest updates
                    regarding your application.
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
            This is an automated notification. Please do not reply to this email.
        </div>

    </div>
</div>

</body>
</html>