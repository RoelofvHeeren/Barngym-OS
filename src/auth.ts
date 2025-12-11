import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = credentials;
                const { email, password } = parsedCredentials;

                if (email === 'Guy@barn-gym.com' && password === 'Barndashboard-2025') {
                    return {
                        id: '1',
                        email: 'Guy@barn-gym.com',
                        name: 'Guy',
                    }
                }

                if (email === 'Roelof@elvison.com' && password === 'Barndashboard-2025') {
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
