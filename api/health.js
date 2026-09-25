/**
 * GET /api/health — liveness check.
 *
 * Replaces Spring Boot Actuator's /actuator/health, which the Elastic
 * Beanstalk load balancer used. Vercel does not need a health check to route
 * traffic, but this stays useful for uptime monitors and for confirming that
 * Functions are deployed (and, locally, that the dev API bridge is working).
 */
export function GET() {
  const body = {
    status: 'UP',
    region: process.env.VERCEL_REGION || 'local',
    environment: process.env.VERCEL_ENV || 'development',
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
