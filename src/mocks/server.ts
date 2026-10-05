import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node-side mock server, used by Vitest and the Next.js dev proxy. */
export const server = setupServer(...handlers);
