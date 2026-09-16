import backend from '../../server/account.cjs';
export default async (request: Request, context: any) => {
  return backend.handle(request, {
    env: (key: string) => Netlify.env.get(key),
    ip: context.ip || 'unknown'
  });
};
export const config = { path: '/api/account' };
