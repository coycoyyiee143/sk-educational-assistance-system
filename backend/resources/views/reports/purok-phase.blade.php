@extends('reports.layout')
@section('content')
    <h3>By Phase</h3>
    <table>
        <thead><tr><th>Phase</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($byPhase as $row)
                <tr><td>{{ $row->purok }}</td><td>{{ $row->total }}</td><td>{{ $row->percentage }}%</td></tr>
            @endforeach
        </tbody>
    </table>
    <h3>By Purok</h3>
    <table>
        <thead><tr><th>Purok</th><th style="width: 80px;">Count</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($byPurok as $row)
                <tr><td>{{ $row->purok }}</td><td>{{ $row->total }}</td><td>{{ $row->percentage }}%</td></tr>
            @endforeach
        </tbody>
    </table>
@endsection