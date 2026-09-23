# Auth — `src/features/auth/`

`components/` (auth-island, login-_, forgot-password-_, reset-password-screen,
new-password-form, change-password-form, profile-form, change-email-form, account-page,
account-link), `api.ts`, `mutations.ts`, `redirect.ts`, `recovery-link.ts`,
`email-change-link.ts`, `profile.ts`, `password.ts`, `errors.ts`.

**Email + password, and no sign-up.** The feature signs a manager in, resets a forgotten
password from `/login`, and lets a signed-in manager change their name, their address and
their password from `/admin/compte` — nothing else. There is deliberately no sign-up form: accounts are
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
PostgREST. What `api.ts` throws is an **`AuthFailure`**, which keeps Supabase's `code`
next to the French message: most screens only print the message, but the account screen
branches on the code (`authFailureCode`). Every call outside sign-in passes a `fallback`
that names its own failure — the default, « Connexion impossible », is a sign-in sentence.

**Keep the credentials message indistinct** between unknown address and wrong password.
Naming which one failed turns the screen into an account-enumeration oracle. The one
exception is `current_password_invalid`, which does name the current password: its caller
is already signed in, so there is no account left to discover.

`router.invalidate()` after sign-in lives in `useSignIn`, not in the route — see
`src/routes/CLAUDE.md`. `useResetPassword` does the same, for the same reason: the manager
arrives from a mail, so every guard has already concluded « not signed in ».
`useChangePassword` is the same call **without** it, split on purpose: a signed-in change
moves no guard's verdict. `useUpdateName` and `useRequestEmailChange` **do** invalidate,
for a third reason: the guard hands every screen a _snapshot_ of the session's `user`, and
the name in the column and the pending address on the account screen are read from it.

## `NewPasswordForm` — one form, two screens

The reset screen and the account screen choose a password with the same component, so the
length rule, the « both fields match » check (`passwordProblem`) and the password-manager
wiring can't drift between them. It owns the fields and that one check; the screen owns
the call, passes `pending` and `error` back in, and decides what happens after.
`askCurrentPassword` adds the current-password field, `username` the hidden address field
(see below).

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
- **The reset screen sends no current password.** Supabase skips that check for a
  recovery session (`session.IsRecovery()` in GoTrue's `user.go`). Consequence worth
  knowing: a manager who has just reset their password and opens `/admin/compte` is still
  in that recovery session, so the current password is not checked there either — they
  proved access to the mailbox minutes earlier.
- **Two settings live outside the code** and the feature is broken without them: the
  return URL (`recoveryUrl`) must be listed in the project's _Redirect URLs_, and the
  _Reset Password_ mail template ships in English.

## Changing the password — `/admin/compte`

**A session is not proof of identity.** `updateUser({ password })` only needs one, and on a
tablet left signed in behind a bar that is the easiest thing in the building to borrow — a
borrowed session that can change the password locks the owner out of their venues. Two
**server-side** settings close that, and the screen is unsafe without both:

| Setting (Authentication → Sign In / Providers → Email) | What Supabase then does                                                                                 | Refusal codes                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Require current password when updating**             | Checks `current_password` on `updateUser` — except for a recovery session                               | `current_password_required`, `current_password_invalid` |
| **Secure password change**                             | Refuses a session created over 24h ago until `reauthenticate()` has mailed a code, sent back as `nonce` | `reauthentication_needed`, `reauthentication_not_valid` |

In the Management API they are `security_update_password_require_current_password` and
`security_update_password_require_reauthentication` (`PATCH /v1/projects/{ref}/config/auth`).
**A `signInWithPassword` re-check from the browser is not a substitute**: anyone holding the
session skips it, it opens a second session, and it burns the sign-in rate limit.

- **The code step is the nominal case.** Sessions refresh silently for weeks, so a manager
  whose session dates from last Tuesday is past 24 hours. `reauthentication_needed` is
  caught and never printed: it sends the code and swaps to the code field. Its translation
  exists only as a safety net.
- **The three typed passwords survive the swap** — the password step is `hidden`, not
  unmounted — and `passwords` holds what was submitted, which is what the retry with the
  code sends.
- **GoTrue verifies the code before it checks the current password** or refuses a reused
  one (`user.go`), outside the update's transaction. A code met with one of those refusals
  is therefore spent: the screen drops it and returns to the passwords, and the next submit
  mails a new one. Short of that, a code already sent is reused — going back to fix a typo
  does not mail a second one.
- **The other devices are signed out after every change**, with `signOut({ scope: 'others' })`
  — the update handler revokes nothing on its own. `'others'` fires no `SIGNED_OUT` here,
  so nothing is invalidated. Access tokens already issued stay valid until they expire (an
  hour by default): the confirmation says « déconnectés », never « immédiatement ».
- **The two calls can split**, so they are two hooks. When the change succeeds and the
  sign-out fails, the password _has_ changed; the screen says exactly that and offers to
  retry the sign-out alone. A generic error there would make the manager change it twice.
- **Password managers**: a visually hidden `autoComplete="username"` field holding the
  address, `current-password` and `new-password` on the fields, `one-time-code` on the code.
  Without the username field the manager's password manager doesn't know which saved login
  the new password belongs to. Clearing the fields after success (the form is remounted
  with a new `key`) is the signal it reads as « the change went through ».
- **The entry point is reachable at every width**: `AccountLink`, passed by
  `_authenticated.tsx` into `BackOfficeShell`'s `account` slot — in the phone's top bar and
  in the column from `lg`. It is a `.rail-link` like every other item of the column, not a
  `NavLink`.
- **`compte` is a reserved slug.** `/admin/compte` is a static child of `/admin`; see
  `src/features/venues/CLAUDE.md`.
- **The _Reauthentication_ mail template ships in English**, like _Reset Password_.

## Name and address — `/admin/compte`

**The name lives in `user_metadata`** (`first_name`, `last_name`), read through
`profileName` (`profile.ts`), not in a table. Nothing but the manager reads it and the
session already carries it: no query, no migration, no policy. The manager can write any
key there, so it is **display data only** — no RLS policy or server decision may read
it. It shows as the account screen's title and above the address in the shell's column
(`BackOfficeShell`'s `name`, a plain string: the shell doesn't read sessions).

**The address change rests on one server-side setting.** `updateUser({ email })` needs
neither the current password nor a reauthentication code — _Secure password change_
covers the password only. What stops a borrowed session from moving the sign-in to an
address its holder reads (then resetting the password from `/login`) is:

| Setting (Authentication → Sign In / Providers → Email) | What Supabase then does                                                                 |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Secure email change**                                | Mails a link to the old _and_ the new address, and switches only once both are followed |

In the Management API it is `mailer_secure_email_change_enabled`. On by default in
Supabase — **the screen's copy promises it**, so switching it off makes the screen lie as
well as the account unsafe.

- **Asking changes nothing yet.** Until both links are followed the address sits in the
  user's `new_email`, which the screen shows as pending, with « Renvoyer les liens ».
  Asking again for the same address resends; another address replaces the pending one.
  The current address is refused on the client: GoTrue answers 200 and mails nothing.
- **The links land on `/admin/compte`** (`EMAIL_CHANGE_PATH`), which must be listed in the
  project's _Redirect URLs_ like the recovery path. The first link followed comes back
  with an English `#message` and no session — only its presence is read, as « now open the
  other one »; a dead link with `#error_code`. `emailChangeNotice` reads the fragment once
  and the screen strips it with `history.replaceState`. The last link comes back with
  tokens, which `supabase-js` consumes before the guard's `getSession()` returns: the new
  address is then just the account's.
- **A link opened in a browser with no session** meets the guard first and goes through
  `/login`; the change itself is recorded by GoTrue either way, only the notice is lost.
- **`email_exists` is translated as such**, naming that another account holds the
  address. Hiding it buys nothing: the caller is signed in and the raw answer says it.
- **The _Change Email Address_ mail template ships in English**, like the other two.
- **The demo account is public.** Anyone can rename it; an address change on it can't
  complete without the demo mailbox's own link.
