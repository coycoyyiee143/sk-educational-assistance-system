@extends('reports.layout')

@section('content')
    <div class="summary-row">
        <div class="summary-cell"><h2>{{ $counts['claimed'] }}</h2><p>Claimed ({{ $rates['claimed_rate'] }}%)</p></div>
        <div class="summary-cell"><h2>{{ $counts['not_cleared'] }}</h2><p>Not Cleared ({{ $rates['not_cleared_rate'] }}%)</p></div>
        <div class="summary-cell"><h2>{{ $counts['unclaimed'] }}</h2><p>Unclaimed ({{ $rates['unclaimed_rate'] }}%)</p></div>
        <div class="summary-cell"><h2>{{ $counts['pending'] }}</h2><p>Awaiting Claiming</p></div>
    </div>

    @if(count($notClearedReasons) > 0)
        <h3>Not Cleared — Common Reasons</h3>
        <table>
            <thead><tr><th>Reason</th><th style="width: 80px;">Count</th></tr></thead>
            <tbody>
                @foreach($notClearedReasons as $reason => $count)
                    <tr><td>{{ $reason }}</td><td>{{ $count }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @endif
@endsection