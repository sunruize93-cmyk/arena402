const GITHUB_CLIENT_ID = 'Ov23li5jawa0KFXEhpX4';
const GITHUB_CALLBACK_URL =
  'https://api.arena402.com/api/auth/github/callback';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const MAX_REQUEST_BYTES = 4096;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type RelayRequest = {
  client_id?: unknown;
  code?: unknown;
  code_verifier?: unknown;
  redirect_uri?: unknown;
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function boundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimum &&
    value.length <= maximum
  );
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: 'request_too_large' }, 413);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'relay_unauthorized' }, 401);
  }
  const clientSecret = authorization.slice('Bearer '.length);
  if (!boundedString(clientSecret, 32, 256)) {
    return jsonResponse({ error: 'relay_unauthorized' }, 401);
  }

  let rawBody: string;
  let body: RelayRequest;
  try {
    rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'request_too_large' }, 413);
    }
    body = JSON.parse(rawBody) as RelayRequest;
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  if (
    body.client_id !== GITHUB_CLIENT_ID ||
    body.redirect_uri !== GITHUB_CALLBACK_URL ||
    !boundedString(body.code, 1, 512) ||
    !boundedString(body.code_verifier, 43, 128)
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }

  const tokenRequest = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: clientSecret,
    code: body.code,
    redirect_uri: GITHUB_CALLBACK_URL,
    code_verifier: body.code_verifier,
  });

  try {
    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Arena402/1.0',
      },
      body: tokenRequest,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const githubBody = (await response.json()) as Record<string, unknown>;
    const filteredBody = Object.fromEntries(
      [
        'access_token',
        'token_type',
        'scope',
        'error',
        'error_description',
        'error_uri',
      ]
        .filter((key) => key in githubBody)
        .map((key) => [key, githubBody[key]]),
    );
    return jsonResponse(filteredBody, response.ok ? 200 : 502);
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? 504
        : 502;
    return jsonResponse({ error: 'github_token_unavailable' }, status);
  }
}
