import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const BodySchema = z.object({
  botToken: z.string().min(10),
  filePath: z.string().min(1).max(512),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
  'Access-Control-Max-Age': '86400',
} as const;

function jsonError(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export const Route = createFileRoute('/api/public/telegram-file')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return jsonError({ error: 'Invalid request' }, 400);
        }

        if (body.filePath.includes('://') || body.filePath.startsWith('/')) {
          return jsonError({ error: 'Invalid Telegram file path' }, 400);
        }

        const upstream = await fetch(
          `https://api.telegram.org/file/bot${body.botToken}/${encodeURI(body.filePath)}`
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => '');
          return jsonError({ error: `Telegram download failed [${upstream.status}]`, details: errorText.slice(0, 300) }, upstream.status);
        }

        return new Response(await upstream.arrayBuffer(), {
          headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});