<style>
    body { font-family: Arial, sans-serif; color: #222; }
    .page-chunk { page-break-after: always; box-sizing: border-box; }
    .page-chunk:last-child { page-break-after: auto; }
    .page-chunk.pdf-mode { width: 100%; padding: 0; }
    .page-chunk.image-mode { width: 1080px; height: 1080px; margin: 0 auto; padding: 20px; overflow: hidden; }
    .header { display: table; width: 100%; margin-bottom: 10px; }
    .header .logo-left, .header .logo-right { display: table-cell; width: 130px; vertical-align: middle; }
    .header .logo-left img, .header .logo-right img { width: 90px; height: 90px; object-fit: contain; }
    .header .center-text { display: table-cell; text-align: center; vertical-align: middle; }
    .header .center-text p { margin: 0; font-size: 10px; line-height: 1.4; }
    .header .center-text .brand { font-weight: bold; font-size: 11px; }
    hr { border: none; border-top: 2px solid #333; margin: 10px 0 20px; }
    h2 { text-align: center; font-size: 16px; margin: 0 0 4px; }
    .page-label { text-align: center; font-size: 12px; color: #555; margin: 0 0 20px; }
    table.col-layout { width: 100%; border-collapse: collapse; }
    table.col-layout > tbody > tr > td.col { width: 33.33%; vertical-align: top; padding: 0; }
    table.col-layout > tbody > tr > td.col-mid { padding-left: 6px; padding-right: 6px; }
    table.col-layout > tbody > tr > td.col-right { padding-left: 6px; }
    table.names { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.names th, table.names td { border: 1px solid #333; text-align: left; line-height: 1.3; overflow: hidden; }
    table.names thead th { background: #f0f0f0; }
    table.names th:first-child, table.names td:first-child { text-align: center; white-space: nowrap; }
    table.names th:last-child, table.names td:last-child { white-space: nowrap; text-overflow: ellipsis; }
    .pdf-mode table.names { table-layout: auto; }
    .pdf-mode table.names th, .pdf-mode table.names td { font-size: 9px; padding: 2px 4px; }
    .pdf-mode table.names th:first-child, .pdf-mode table.names td:first-child { width: auto; white-space: nowrap; }
    .image-mode table.names th, .image-mode table.names td { font-size: 11px; padding: 3px 5px; }
    .image-mode table.names th:first-child, .image-mode table.names td:first-child { width: 78px; }
</style>

@php
    $perPage = $perPage ?? 100;
    $chunks = $applicants->chunk($perPage)->values();
    $totalPages = $chunks->count();
    $modeClass = $forPdf ? 'pdf-mode' : 'image-mode';
@endphp

@forelse($chunks as $index => $chunk)
    @php
        $chunkValues = $chunk->values();
        $third = (int) ceil($chunkValues->count() / 3);
        $colLeft = $chunkValues->slice(0, $third)->values();
        $colMid = $chunkValues->slice($third, $third)->values();
        $colRight = $chunkValues->slice($third * 2)->values();
    @endphp
    <div class="page-chunk {{ $modeClass }}" data-page="{{ $index + 1 }}">
        <div class="header">
            <div class="logo-left">
                <img src="{{ $forPdf ? public_path('icons/mamatid-logo.jpg') : asset('icons/mamatid-logo.jpg') }}">
            </div>
            <div class="center-text">
                <p>Republic of the Philippines</p>
                <p>Province of Laguna</p>
                <p class="brand">City of Cabuyao</p>
                <p class="brand">BARANGAY MAMATID</p>
                <p><em>email address: skmamatid@gmail.com</em></p>
                <p>OFFICE OF SANGGUNIANG KABATAAN</p>
            </div>
            <div class="logo-right">
                <img src="{{ $forPdf ? public_path('icons/sk-logo.jpg') : asset('icons/sk-logo.jpg') }}">
            </div>
        </div>
        <hr>

        <h2>EDUCATIONAL ASSISTANCE {{ $schoolYear }}</h2>
        @if($totalPages > 1)
            <p class="page-label">Page {{ $index + 1 }} of {{ $totalPages }}</p>
        @endif

        <table class="col-layout">
            <tbody>
                <tr>
                    <td class="col col-left">
                        <table class="names">
                            <thead><tr><th>CTRL NO.</th><th>NAME</th></tr></thead>
                            <tbody>
                                @foreach($colLeft as $a)
                                    <tr><td>{{ $a['control_number'] }}</td><td>{{ $a['name'] }}</td></tr>
                                @endforeach
                            </tbody>
                        </table>
                    </td>
                    <td class="col col-mid">
                        <table class="names">
                            <thead><tr><th>CTRL NO.</th><th>NAME</th></tr></thead>
                            <tbody>
                                @foreach($colMid as $a)
                                    <tr><td>{{ $a['control_number'] }}</td><td>{{ $a['name'] }}</td></tr>
                                @endforeach
                            </tbody>
                        </table>
                    </td>
                    <td class="col col-right">
                        <table class="names">
                            <thead><tr><th>CTRL NO.</th><th>NAME</th></tr></thead>
                            <tbody>
                                @foreach($colRight as $a)
                                    <tr><td>{{ $a['control_number'] }}</td><td>{{ $a['name'] }}</td></tr>
                                @endforeach
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
@empty
    <div class="page-chunk {{ $modeClass }}">
        <div class="header">
            <div class="logo-left">
                <img src="{{ $forPdf ? public_path('icons/mamatid-logo.jpg') : asset('icons/mamatid-logo.jpg') }}">
            </div>
            <div class="center-text">
                <p>Republic of the Philippines</p>
                <p>Province of Laguna</p>
                <p class="brand">City of Cabuyao</p>
                <p class="brand">BARANGAY MAMATID</p>
                <p><em>email address: skmamatid@gmail.com</em></p>
                <p>OFFICE OF SANGGUNIANG KABATAAN</p>
            </div>
            <div class="logo-right">
                <img src="{{ $forPdf ? public_path('icons/sk-logo.jpg') : asset('icons/sk-logo.jpg') }}">
            </div>
        </div>
        <hr>
        <h2>EDUCATIONAL ASSISTANCE {{ $schoolYear }}</h2>
        <table class="names">
            <thead><tr><th>CTRL NO.</th><th>NAME</th></tr></thead>
            <tbody><tr><td colspan="2">No approved applicants for this period.</td></tr></tbody>
        </table>
    </div>
@endforelse