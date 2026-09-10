<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Force route()/url() to generate https:// links whenever APP_URL
        // is https, regardless of what scheme Nginx/Apache forwards to
        // PHP-FPM internally. Without this, reverse-proxy setups often
        // generate http:// URLs even on a fully HTTPS site, which the
        // browser then blocks as mixed content (exactly what's happening
        // with the face-verification photo_url right now).
        if (str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}