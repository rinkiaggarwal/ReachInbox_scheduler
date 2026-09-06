'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@reachinbox.ai');
  const [name, setName] = useState('Alex Growth');
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        name,
        redirect: false,
      });

      if (res?.ok) {
        toast.success(`Signed in as ${name}`);
        router.push('/dashboard');
      } else {
        toast.error('Sign in failed');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-bg-pitch text-text-main">
      <div className="w-full max-w-sm space-y-6 bg-bg-card p-6 rounded-lg border border-border-subtle shadow-card-subtle">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded bg-red mx-auto flex items-center justify-center text-white">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              REACH<span className="text-red">INBOX</span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Email Scheduler & Queue Engine</p>
          </div>
        </div>

        {/* OAuth Button */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-2 font-medium text-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <span className="relative bg-bg-card px-2 text-[10px] font-semibold uppercase text-text-muted">
              Or Quick Sign In
            </span>
          </div>

          {/* Quick Sign In Form */}
          <form onSubmit={handleDemoSignIn} className="space-y-3">
            <Input
              label="Name"
              placeholder="Alex Growth"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="demo@reachinbox.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full font-medium text-xs"
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
