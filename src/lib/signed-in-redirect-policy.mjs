/**
 * Keep the sign-in page's initial-session redirect from racing with a session
 * that was created by the credential form after the page rendered.
 *
 * @param {{
 *   loading: boolean;
 *   hasSession: boolean;
 *   sawUnauthenticated: boolean;
 * }} input
 * @returns {{ redirect: boolean; sawUnauthenticated: boolean }}
 */
export function nextSignedInRedirectState({
  loading,
  hasSession,
  sawUnauthenticated,
}) {
  if (loading) {
    return { redirect: false, sawUnauthenticated };
  }
  if (!hasSession) {
    return { redirect: false, sawUnauthenticated: true };
  }
  return {
    redirect: !sawUnauthenticated,
    sawUnauthenticated,
  };
}
