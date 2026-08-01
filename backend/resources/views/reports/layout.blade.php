<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #212529; margin: 30px; }
        .header { border-bottom: 3px solid #8B0000; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; margin: 0 0 4px 0; color: #8B0000; }
        .header p { margin: 0; color: #6c757d; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #dee2e6; padding: 6px 8px; text-align: left; }
        th { background: #f8f9fa; font-weight: bold; }
        .summary-row { display: table; width: 100%; margin-bottom: 16px; }
        .summary-cell { display: table-cell; width: 25%; text-align: center; padding: 10px; border: 1px solid #dee2e6; }
        .summary-cell h2 { margin: 0; font-size: 22px; color: #8B0000; }
        .summary-cell p { margin: 4px 0 0 0; font-size: 9px; color: #6c757d; }
        h3 { font-size: 13px; color: #8B0000; margin-top: 20px; margin-bottom: 8px; }
        .footer { margin-top: 30px; font-size: 9px; color: #6c757d; text-align: center; border-top: 1px solid #dee2e6; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ $title }}</h1>
        <p>Sangguniang Kabataan of Barangay Mamatid — Educational Assistance Program</p>
        <p>
            @if($config)
                School Year: {{ $config->school_year }} &nbsp;|&nbsp;
            @endif
            Generated: {{ now()->format('F j, Y g:i A') }}
        </p>
    </div>

    @yield('content')

    <div class="footer">
        This is a system-generated report from the SK Educational Assistance System.
    </div>
</body>
</html>