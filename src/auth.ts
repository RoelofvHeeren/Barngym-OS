import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const { email, password } = credentials as any;

                if (email.toLowerCase() === 'guy@barn-gym.com' && password === 'Barndashboard-2025') {
                    return {
                        id: '1',
                        email: 'Guy@barn-gym.com',
                        name: 'Guy',
                    }
                }

                if (email.toLowerCase() === 'roelof@elvison.com' && password === 'Barndashboard-2025') {
                    return {
                        id: '2',
                        email: 'Roelof@elvison.com',
                        name: 'Roelof',
                    }
                }

                return null;
            },
        }),
    ],
});
