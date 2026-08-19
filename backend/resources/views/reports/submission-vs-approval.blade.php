@extends('reports.layout')

@section('content')
    <table>
        <thead>
            <tr>
                <th>School Year</th>
                <th>Total Submitted</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Pending</th>
                <th>Approval Rate</th>
                <th>Rejection Rate</th>
                <th>Pending Rate</th>
            </tr>
        </thead>
        <tbody>
            @foreach($trend as $row)
                <tr>
                    <td>{{ $row['school_year'] }}</td>
                    <td>{{ $row['total_submitted'] }}</td>
                    <td>{{ $row['approved'] }}</td>
                    <td>{{ $row['rejected'] }}</td>
                    <td>{{ $row['pending'] }}</td>
                    <td>{{ $row['approval_rate'] }}%</td>
                    <td>{{ $row['rejection_rate'] }}%</td>
                    <td>{{ $row['pending_rate'] }}%</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection