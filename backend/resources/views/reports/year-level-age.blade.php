@extends('reports.layout')

@section('content')
    <h3>By Year Level</h3>
    <table>
        <thead><tr><th>Year Level</th><th style="width: 80px;">Count</th></tr></thead>
        <tbody>
            @foreach($byYearLevel as $row)
                <tr><td>{{ $row->year_level }}</td><td>{{ $row->total }}</td></tr>
            @endforeach
        </tbody>
    </table>

    <h3>By Age</h3>
    <div class="summary-row">
        <div class="summary-cell"><h2>{{ $counts['minor'] }}</h2><p>Minor ({{ $rates['minor_rate'] }}%)</p></div>
        <div class="summary-cell"><h2>{{ $counts['adult'] }}</h2><p>Adult ({{ $rates['adult_rate'] }}%)</p></div>
        @if($counts['unknown'] > 0)
            <div class="summary-cell"><h2>{{ $counts['unknown'] }}</h2><p>Unknown ({{ $rates['unknown_rate'] }}%)</p></div>
        @endif
    </div>
@endsection