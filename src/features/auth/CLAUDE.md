# Auth — `src/features/auth/`

`components/` (auth-island, login-_, forgot-password-_, reset-password-*), `api.ts`,
`mutations.ts`, `redirect.ts`, `recovery-link.ts`, `password.ts`, `errors.ts`.

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
`src/routes/CLAUDE.md`. `useUpdatePassword` does the same, for the same reason: the
manager arrives from a mail, so every guard has already concluded « not signed in ».

## Password reset

Three screens share one frame, `AuthIsland`: sign in, ask for a link, set a password. It
exists because a manager meets them minutes apart — a card that shifted between two steps
would read as a different site. Only its `title` is a node, so the reset screen can put a
loading bar in the real `h1` while it still has no title to show.

- **The reset route carries no guard, and that is the point.** The recovery link opens a
  session _before_ the route is reached, so `login.tsx`'s « already signed in → /admin »
  guard would make the screen unreachable for exactly the people it exists for.
- **A dead link is the nominal case**, not an edge case: a recovery link is single-use and
  expires. `recoveryLinkError` therefore always returns a sentence — reaching the screen
  without a session means the link failed, whether or not Supabase said why — and the
  screen it feeds offers a new one.
- **`getSession()` is what waits for the link to be consumed.** It awaits the client's
  initialisation, which is where `supabase-js` reads the tokens out of the URL. Past that
  await the answer is final, and on failure the hash is still readable: Supabase only
  clears it on success. Read `error_code` and nothing else — `error_description` arrives
  in English.
- **The confirmation says « si un compte existe » on purpose.** `resetPasswordForEmail`
  answers 200 for an unknown address, and the screen must not be more informative than the
  API: confirming only for known addresses would be the account-enumeration oracle that
  the credentials message is written to avoid.
- **`passwordProblem` checks what the API cannot** — that the two fields match. Two
  identically mistyped passwords are a valid pair for Supabase, and the manager would be
  locked out by a password they never meant to set.
- **Nothing in `updatePassword` proves the caller followed a link**; `updateUser` only
  needs a session. The boundary is server-side, as everywhere else here: the project's
  **Secure password change** setting makes Supabase refuse the change on a session that is
  not recent.
- **Two settings live outside the code** and the feature is broken without them: the
  return URL (`recoveryUrl`) must be listed in the project's _Redirect URLs_, and the
  _Reset Password_ mail template ships in English.
