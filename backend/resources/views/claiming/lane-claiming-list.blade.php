@extends('claiming.layout')

@section('meta')
    <p>Batch: {{ $batch === 'morning' ? 'Morning' : 'Afternoon' }} &nbsp;|&nbsp; Date: {{ $claimingDate }}</p>
@endsection

@section('content')
    <table>
        <thead>
            <tr><th>#</th><th>Control Number</th><th>Applicant Name</th><th>Signature</th></tr>
        </thead>
        <tbody>
            @foreach ($applicants as $i => $a)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $a['control_number'] }}</td>
                    <td>{{ $a['name'] }}</td>
                    <td></td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endsection