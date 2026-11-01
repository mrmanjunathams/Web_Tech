// Shared test utilities (excluded from coverage).
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { Account, BlogPost } from '../core/api';

/** HttpClient backed by HttpTestingController, plus a router (hash-free, for tests). */
export function testProviders(routes: Routes = [], ...extra: (Provider | EnvironmentProviders)[]) {
  return [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes), ...extra];
}

export const http = () => TestBed.inject(HttpTestingController);

let nextId = 1;
export function blog(over: Partial<BlogPost> = {}): BlogPost {
  return {
    _id: `b${nextId++}`,
    auth: 'amy',
    authName: 'Amy Writer',
    title: 'A trip',
    cate: 'Travel | Art',
    date: '01-NOV-2026',
    img: 'img1',
    blogp1: 'An opening paragraph.',
    blogp2: '<p>The <strong>rest</strong> of it.</p>',
    status: 'published',
    publishAt: '2026-11-01T10:00:00.000Z',
    likes: 0,
    liked: false,
    views: 0,
    ...over,
  };
}

export function account(over: Partial<Account> = {}): Account {
  return { username: 'amy', name: 'Amy Writer', email: 'amy@example.com', createdAt: '2026-10-01T00:00:00.000Z', blogs: [], ...over };
}

/** Lets pending promises (API calls already flushed, timers at 0) settle, then re-renders. */
export async function settle(fixture?: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
  else await new Promise((r) => setTimeout(r, 0));
  if (fixture) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

/** Responds to the one open request matching `url` (method optional). */
export function respond(url: string, body: unknown, opts: { method?: string; status?: number } = {}) {
  const req = http().expectOne((r) => r.url === url && (!opts.method || r.method === opts.method));
  if (opts.status === 0) req.error(new ProgressEvent('error'), { status: 0 }); // network failure
  else if (opts.status && opts.status >= 400) req.flush((body ?? { error: "Failed" }) as Parameters<typeof req.flush>[0], { status: opts.status, statusText: "Error" });
  else req.flush(body as Parameters<typeof req.flush>[0]);
  return req.request;
}

/** Text content of an element found by selector. */
export const text = (root: HTMLElement, selector: string) => root.querySelector(selector)?.textContent?.trim() ?? '';

/** Clicks the first element matching `selector` (or with exactly this text, when `withText` is given). */
export function click(root: HTMLElement, selector: string, withText?: string) {
  const el = [...root.querySelectorAll<HTMLElement>(selector)].find((e) => withText === undefined || e.textContent?.includes(withText));
  if (!el) throw new Error(`No element for ${selector} ${withText ?? ''}`);
  el.click();
  return el;
}

/** Types into an input/textarea and fires the input event. */
export function type(root: HTMLElement, selector: string, value: string) {
  const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) throw new Error(`No input ${selector}`);
  el.value = value;
  el.dispatchEvent(new Event('input'));
  return el;
}
