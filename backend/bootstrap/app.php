<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // change the default redirect for unauthenticated users to return a JSON response instead of redirecting to a login page
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo(fn () => response()->json(['message' => 'Unauthenticated.'], 401));
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
        ]);
    })

    ->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'log.visit' => \App\Http\Middleware\LogPageVisit::class,
    ]);
})

    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();

    

    
