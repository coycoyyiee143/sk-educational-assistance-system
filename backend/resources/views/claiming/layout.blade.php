<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
        h2 { color: #b71c1c; margin-bottom: 4px; }
        p { margin-top: 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 14px; }
        thead { background: #b71c1c; color: white; }
        td:last-child, th:last-child { width: 220px; }
    </style>
</head>
<body>
    <h2>{{ $title }}</h2>
    @yield('meta')

    @yield('content')
</body>
</html>