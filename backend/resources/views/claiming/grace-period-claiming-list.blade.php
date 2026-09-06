@extends('claiming.layout')

@section('content')
    <table>
        <thead>
            <tr>
                <th style="width: 40px;">#</th>
                <th>Control Number</th>
                <th>Applicant Name</th>
                <th style="width: 140px;">Type</th>
                <th style="width: 180px;">Signature</th>
            </tr>
        </thead>
        <tbody>
            @php $rowNum = 1; @endphp
            @forelse($retrying as $a)
                <tr>
                    <td>{{ $rowNum++ }}</td>
                    <td>{{ $a->application->control_number }}</td>
                    <td>{{ $a->application->user->first_name }} {{ $a->application->user->last_name }}</td>
                    <td>Retrying</td>
                    <td></td>
                </tr>
            @empty
            @endforelse

            @forelse($promoted as $a)
                <tr>
                    <td>{{ $rowNum++ }}</td>
                    <td>{{ $a->application->control_number }}</td>
                    <td>{{ $a->application->user->first_name }} {{ $a->application->user->last_name }}</td>
                    <td>Promoted</td>
                    <td></td>
                </tr>
            @empty
            @endforelse

            @if($retrying->count() === 0 && $promoted->count() === 0)
                <tr><td colspan="5">No applicants expected during grace period for this period.</td></tr>
            @endif
        </tbody>
    </table>
@endsection