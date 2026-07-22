<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;

class LogPageVisit
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        if ($request->user()) {
            AuditLog::record(
                'page_visited',
                null,
                'Visited: ' . ($request->route()?->getName() ?? $request->path())
            );
        }

        return $response;
    }
}