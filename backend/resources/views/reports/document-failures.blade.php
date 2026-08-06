@extends('reports.layout')

@section('content')
    @if(count($reuploadFlagCounts) > 0)
        <h3>Re-upload Requests by Document</h3>
        <table>
            <thead><tr><th>Document</th><th style="width: 80px;">Count</th></tr></thead>
            <tbody>
                @foreach($reuploadFlagCounts as $docType => $count)
                    <tr><td>{{ ucwords(str_replace('_', ' ', $docType)) }}</td><td>{{ $count }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @endif

    @foreach($reuploadReasonsByDoc as $docType => $reasons)
        <h3>{{ ucwords(str_replace('_', ' ', $docType)) }} — Reasons</h3>
        <table>
            <thead><tr><th>Reason</th><th style="width: 80px;">Count</th></tr></thead>
            <tbody>
                @foreach($reasons as $reason => $count)
                    <tr><td>{{ $reason }}</td><td>{{ $count }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @endforeach

    @if(count($automatedFailuresByDoc) > 0)
        <h3>Automated OCR Check Failures by Document</h3>
        <table>
            <thead><tr><th>Document</th><th>Check</th><th style="width: 80px;">Failures</th></tr></thead>
            <tbody>
                @foreach($automatedFailuresByDoc as $docType => $checks)
                    @foreach($checks as $checkName => $count)
                        <tr><td>{{ ucwords(str_replace('_', ' ', $docType)) }}</td><td>{{ $checkName }}</td><td>{{ $count }}</td></tr>
                    @endforeach
                @endforeach
            </tbody>
        </table>
    @endif
@endsection