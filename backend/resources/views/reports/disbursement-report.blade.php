<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            color: #222;
            font-size: 12px;
        }
        h2 {
            color: #b71c1c;
            margin-bottom: 4px;
        }
        p {
            margin-top: 0;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
        }
        th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: left;
            font-size: 11px;
        }
        thead {
            background: #b71c1c;
            color: white;
        }
        .summary-box {
            margin-top: 16px;
            padding: 10px;
            border: 1px solid #ddd;
            background: #f9f9f9;
        }
        .summary-box strong {
            color: #b71c1c;
        }
    </style>
</head>
<body>
    <h2>{{ $title }}</h2>
    <p>
        School Year: {{ $config->school_year ?? '—' }}
        @if($config->is_active ?? false) (Active) @endif
    </p>

    <table>
        <thead>
            <tr>
                <th>Control Number</th>
                <th>Applicant Name</th>
                <th>School</th>
                <th>Lane</th>
                <th>Claiming Date</th>
                <th>Disbursed By</th>
                <th>Disbursed At</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            @forelse($entries as $entry)
                <tr>
                    <td>{{ $entry->control_number ?? '—' }}</td>
                    <td>{{ $entry->applicant_name }}</td>
                    <td>{{ $entry->school_name }}</td>
                    <td>{{ $entry->lane_name ?? '—' }}</td>
                    <td>{{ $entry->claiming_date ?? '—' }}</td>
                    <td>{{ $entry->verifier_name ?? '—' }}</td>
                    <td>{{ $entry->verified_at ? \Carbon\Carbon::parse($entry->verified_at)->format('M d, Y g:i A') : '—' }}</td>
                    <td>₱{{ number_format($entry->amount, 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8" style="text-align: center; color: #888;">No disbursements recorded for this period.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="summary-box">
        <strong>Total Disbursed:</strong> {{ $totalDisbursed }} applicant(s)<br>
        <strong>Total Amount:</strong> ₱{{ number_format($totalAmount, 2) }}
    </div>
</body>
</html>