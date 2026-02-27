import { FormEvent, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeToEmailList } from '../lib/emailListApi';

type SignupState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

type EmailSignupBandProps = {
  className?: string;
};

export function EmailSignupBand({ className = '' }: EmailSignupBandProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SignupState>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim();
    if (!normalized) {
      setState('error');
      setMessage('Please enter an email address.');
      return;
    }

    setState('submitting');
    setMessage('');
    try {
      const result = await subscribeToEmailList(normalized);
      if (result.alreadySubscribed) {
        setState('duplicate');
        setMessage("You're already on the list. You're all set.");
      } else {
        setState('success');
        setMessage('We got it! You are now on the list.');
      }
      setEmail('');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Unable to subscribe right now.');
    }
  };

  return (
    <section className={`lux-card p-6 sm:p-8 ${className}`}>
      <div className="space-y-3 text-center">
        <h2 className="lux-heading text-3xl sm:text-4xl">Join our Email List</h2>
      </div>

      <form className="mt-6 w-full max-w-2xl mx-auto" onSubmit={handleSubmit}>
        <label htmlFor="email-list-address" className="sr-only">
          Email address
        </label>
        <div className="relative">
          <input
            id="email-list-address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="lux-input h-12 w-full pr-28 text-sm placeholder:font-serif placeholder:tracking-[0.03em] placeholder:text-charcoal/60"
          />
          <button
            type="submit"
            disabled={state === 'submitting'}
            className="lux-button absolute right-1.5 top-1/2 h-9 -translate-y-1/2 px-4 text-[11px] disabled:opacity-60"
          >
            {state === 'submitting' ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Joining...
              </span>
            ) : (
              'Join'
            )}
          </button>
        </div>
      </form>

      {state === 'success' && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {state === 'duplicate' && <p className="mt-3 text-sm text-deep-ocean/80">{message}</p>}
      {state === 'error' && <p className="mt-3 text-sm text-rose-700">{message}</p>}
    </section>
  );
}
