<?php
// added this for role-based access control (RBAC) to restrict access to certain routes based on user roles
//so user can't technically call admin/verifier endpoints.
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Restrict access to users whose `role` matches one of the given roles.
     * Usage in routes: ->middleware('role:sk_admin') or ->middleware('role:sk_admin,sk_verifier')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !in_array($user->role, $roles, true)) {
            return response()->json([
                'message' => 'Forbidden. You do not have permission to access this resource.',
            ], 403);
        }

        return $next($request);
    }
}