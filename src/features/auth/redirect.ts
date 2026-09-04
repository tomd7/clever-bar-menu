/** Destination par défaut après connexion. */
export const DEFAULT_REDIRECT = '/admin'

/**
 * Une destination de redirection vient de l'URL, donc de l'utilisateur, donc
 * potentiellement d'un lien piégé. On n'accepte qu'un chemin interne : refuser
 * `//evil.com` autant que `https://evil.com`, sans quoi la page de connexion
 * devient un tremplin de phishing (open redirect).
 */
export function sanitizeRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return undefined
  }
  return value
}
