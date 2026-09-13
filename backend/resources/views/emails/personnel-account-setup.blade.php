<p>Hi {{ $firstName }},</p>

@if ($isNewAccount)
    <p>An SK-EAS account has been created for you. Click the link below to set your password and activate your account:</p>
@else
    <p>Your SK-EAS password has been reset by an administrator. Click the link below to set a new password:</p>
@endif

<p><a href="{{ $setupUrl }}">Set My Password</a></p>

<p>This link expires in 3 days and can only be used once. If you didn't expect this email, contact your SK admin immediately.</p>