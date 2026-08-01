@extends('reports.layout')

@section('content')
    <div class="summary-row">
        <div class="summary-cell"><h2>{{ $counts['minor'] }}</h2><p>Minor Applicants ({{ $rates['minor_rate'] }}%)</p></div>
        <div class="summary-cell"><h2>{{ $counts['adult'] }}</h2><p>Adult Applicants ({{ $rates['adult_rate'] }}%)</p></div>
        @if($counts['unknown'] > 0)
            <div class="summary-cell"><h2>{{ $counts['unknown'] }}</h2><p>Unknown ({{ $rates['unknown_rate'] }}%)</p></div>
        @endif
    </div>
@endsection