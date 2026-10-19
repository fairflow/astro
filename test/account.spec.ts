import { describe, expect, it } from 'vitest';
import { signInMessage } from '../src/api/account.svelte.js';

describe('sign-in messages', () => {
  it('says the same thing for an unknown email and a wrong password', () => {
    expect(signInMessage(401, { error: 'wrong email or password' })).toBe('Wrong email or password.');
  });
  it('turns the server wait into whole minutes', () => {
    expect(signInMessage(429, { retryAfter: 61 })).toBe('Too many attempts. Try again in 2 minutes.');
    expect(signInMessage(429, { retryAfter: 30 })).toBe('Too many attempts. Try again in 1 minute.');
    expect(signInMessage(429, null)).toBe('Too many attempts. Try again in 15 minutes.');
  });
  it('anything else names the status', () => {
    expect(signInMessage(500, null)).toBe('Sign-in failed (HTTP 500). Try again later.');
  });
  it('a refused sign-in for an account state shows the server\'s explanation', () => {
    expect(signInMessage(403, { error: 'pending', message: 'Your account is waiting for approval.' }))
      .toBe('Your account is waiting for approval.');
    expect(signInMessage(403, { error: 'missing request header' })).toBe('Sign-in failed (HTTP 403). Try again later.');
  });
});
