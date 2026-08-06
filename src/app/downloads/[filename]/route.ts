const CONNECTOR_DOWNLOAD_ORIGIN = (
  process.env.CONNECTOR_DOWNLOAD_ORIGIN
  || process.env.API_PROXY_TARGET
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://api.arena402.com'
).replace(/\/$/, '');

const INSTALLERS = {
  'install.ps1': {
    downloadName: 'install-connector.ps1',
    contentType: 'text/plain; charset=utf-8',
  },
  'install.sh': {
    downloadName: 'install-connector.sh',
    contentType: 'application/x-sh; charset=utf-8',
  },
} as const;

type InstallerFilename = keyof typeof INSTALLERS;

function isInstallerFilename(value: string): value is InstallerFilename {
  return Object.hasOwn(INSTALLERS, value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!isInstallerFilename(filename)) {
    return Response.json({ error: 'connector_installer_not_found' }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${CONNECTOR_DOWNLOAD_ORIGIN}/downloads/${encodeURIComponent(filename)}`,
      { cache: 'no-store' },
    );
  } catch {
    return Response.json({ error: 'connector_installer_unavailable' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'connector_installer_unavailable' }, { status: 502 });
  }

  const installer = INSTALLERS[filename];
  const headers = new Headers({
    'Cache-Control': 'public, max-age=300',
    'Content-Disposition': `attachment; filename="${installer.downloadName}"`,
    'Content-Type': installer.contentType,
    'X-Content-Type-Options': 'nosniff',
  });
  const contentLength = upstream.headers.get('Content-Length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
