import { createFileRoute } from '@tanstack/react-router'

import { ForgotPasswordScreen } from '#/features/auth/components/forgot-password-screen'

/**
 * Demande d'un lien de réinitialisation.
 *
 * Server-rendered, unlike its two neighbours: this screen reads no session, so
 * there is nothing here that would conclude « not signed in » on the server.
 * The address to come back to is read in the submit handler, in the browser.
 */
export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordScreen,
})
