@extends('reports.layout')

@section('content')
    <table>
        <thead><tr><th>Week Of</th><th style="width: 80px;">Submissions</th><th style="width: 80px;">% of Total</th></tr></thead>
        <tbody>
            @foreach($weekly as $row)
                <tr>
                    <td>{{ \Carbon\Carbon::parse($row->week_start)->format('F j, Y') }}</td>
                    <td>{{ $row->total }}</td>
                    <td>{{ $row->percentage }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection