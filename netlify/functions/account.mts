import backend from '../../server/account.mjs';
export default async (request: Request, context: any) => {
  return backend.handle(request, {
    env: (key: string) => typeof Netlify !== 'undefined' && Netlify.env
      ? Netlify.env.get(key)
      : process.env[key],
    ip: context.ip || 'unknown'
  });
};
export const config = { path: '/api/account' };
