# Auth — `src/features/auth/`

`components/` (login-screen, login-form), `api.ts`, `mutations.ts`, `redirect.ts`,
`errors.ts`.

**Email + password, sign-in only.** There is deliberately no sign-up form: accounts are
provisioned by the platform administrator (Supabase dashboard → Authentication → Users →
Add user, with _Auto Confirm User_). **Don't add a sign-up screen back** without being
asked.

**The missing sign-up form is not a security control.** `/auth/v1/signup` stays reachable
with the publishable key, and the SDK ships `signUp` in the bundle no matter what the app
code does. Self-registration is closed only by the project's **Allow new users to sign up**
setting. Check it with:

```bash
curl -s "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

`disable_signup` must be `true`.

**Supabase auth errors arrive in English.** `translateAuthError` (`errors.ts`) maps
`AuthApiError.code` — fed from the API's `error_code` — to French, and `api.ts` applies it
so the thrown message is already translated: the auth counterpart of `describeError` for
PostgREST.

**Keep the credentials message indistinct** between unknown address and wrong password.
Naming which one failed turns the screen into an account-enumeration oracle.

`router.invalidate()` after sign-in lives in `useSignIn`, not in the route — see
`src/routes/CLAUDE.md`.
