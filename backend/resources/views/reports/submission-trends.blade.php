@extends('reports.layout')

@section('content')
    <table>
        <thead><tr><th>Week Of</th><th style="width: 80px;">Submissions</th></tr></thead>
        <tbody>
            @foreach($weekly as $row)
                <tr><td>{{ \Carbon\Carbon::parse($row->week_start)->format('F j, Y') }}</td><td>{{ $row->total }}</td></tr>
            @endforeach
        </tbody>
    </table>
@endsection