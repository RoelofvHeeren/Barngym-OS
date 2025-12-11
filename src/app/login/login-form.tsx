'use client';

import { useActionState } from 'react';
import { authenticate } from '@/app/lib/actions';
import { Loader2 } from 'lucide-react';

export default function LoginForm() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );

    return (
        <div className="w-[350px] bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6 space-y-2">
                <h3 className="text-2xl font-bold leading-none tracking-tight">Login</h3>
                <p className="text-sm text-gray-500">
                    Enter your email below to login to your account.
                </p>
            </div>
            <div className="p-6 pt-0">
                <form action={formAction}>
                    <div className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                placeholder="name@example.com"
                                required
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Password</label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                required
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-black text-white hover:bg-black/90 h-10 px-4 py-2 w-full"
                            disabled={isPending}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Log in
                        </button>
                        <div
                            className="flex h-8 items-end space-x-1"
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            {errorMessage && (
                                <p className="text-sm text-red-500">{errorMessage}</p>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
