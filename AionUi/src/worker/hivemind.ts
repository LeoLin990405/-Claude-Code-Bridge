/**
 * Hivemind worker entry point.
 *
 * HivemindAgentManager runs in the main process and talks to gateway over HTTP/SSE.
 * This worker file exists to satisfy BaseAgentManager/ForkTask module resolution.
 */

export {};

if (require.main === module) {
  console.log('Hivemind worker started');
}

