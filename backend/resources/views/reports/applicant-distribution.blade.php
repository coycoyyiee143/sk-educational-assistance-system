@extends('reports.layout')
@section('content')
    <h3>By School</h3>
    <table>
        <thead><tr><th>School</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($bySchool as $row)
                <tr><td>{{ $row->school_name }}</td><td>{{ $row->total }}</td><td>{{ $row->percentage }}%</td></tr>
            @endforeach
        </tbody>
    </table>
    <h3>By Course</h3>
    <table>
        <thead><tr><th>Course</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($byCourse as $row)
                <tr><td>{{ $row->course }}</td><td>{{ $row->total }}</td><td>{{ $row->percentage }}%</td></tr>
            @endforeach
        </tbody>
    </table>
    <h3>By Year Level</h3>
    <table>
        <thead><tr><th>Year Level</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($byYearLevel as $row)
                <tr><td>{{ $row->year_level }}</td><td>{{ $row->total }}</td><td>{{ $row->percentage }}%</td></tr>
            @endforeach
        </tbody>
    </table>
    <h3>By Purok/Phase</h3>
    <table>
        <thead><tr><th>Type</th><th>Value</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($byPurok as $row)
                <tr>
                    <td>{{ $row->purok_type === 'unspecified' ? '—' : ucfirst($row->purok_type) }}</td>
                    <td>{{ $row->purok }}</td>
                    <td>{{ $row->total }}</td>
                    <td>{{ $row->percentage }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection