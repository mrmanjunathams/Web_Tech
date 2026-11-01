import { HttpErrorResponse } from '@angular/common/http';

/** 'scheduled' = published with a future publishAt; only the author sees drafts and scheduled stories. */
export type BlogStatus = 'draft' | 'scheduled' | 'published';

export interface BlogPost {
  _id: string;
  /** Author's username (identity). Show `authName` instead. */
  auth: string;
  /** Author's display name. */
  authName: string;
  title: string;
  cate: string;
  date: string;
  img: string;
  /** Opening paragraph, plain text (also the card excerpt). */
  blogp1: string;
  /** Story body: sanitized HTML from the rich-text editor. */
  blogp2: string;
  status: BlogStatus;
  publishAt: string | null;
  likes: number;
  liked: boolean;
  views: number;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** What the editor sends; every field optional because drafts may be incomplete. */
export interface BlogInput {
  title?: string;
  cate?: string;
  img?: string;
  blogp1?: string;
  blogp2?: string;
  status?: 'draft' | 'published';
  /** ISO time to go live (scheduled), or null for "now". */
  publishAt?: string | null;
}

export interface Account {
  username: string;
  /** Display name; empty for accounts created before names existed. */
  name: string;
  email: string;
  createdAt?: string;
  blogs: BlogPost[];
}

export interface Stats {
  blogs: number;
  writers: number;
  categories: number;
  likes: number;
}

export interface Leader {
  username: string;
  name: string;
  posts: number;
  likes: number;
  views: number;
}

/** Turns an API error into a message suitable for showing to the user. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.error?.error) return err.error.error;
    if (err.status === 0) return 'Cannot reach the server. Is it running?';
  }
  return fallback;
}

/** Name to show for a signed-in account. */
export const displayName = (a: Pick<Account, 'name' | 'username'>) => a.name || a.username;

/**
 * Web-sized Image Pool picture (see frontend/scripts/optimize-images.mjs):
 * 'sm' (800px) for cards and thumbnails, 'lg' (1800px) for covers and full-screen views.
 */
export const imageUrl = (img: string, size: 'sm' | 'lg' = 'sm') => `picyourpic/opt/${img}-${size === 'lg' ? 1800 : 800}.webp`;

/** Categories are stored as "Travel | Vacation". */
export const categoriesOf = (cate: string) => cate.split('|').map((c) => c.trim()).filter(Boolean);

/** Visible text of an HTML fragment (story bodies are HTML). */
export function textOf(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent!; // never null for an element
}

export function wordCount(...texts: string[]): number {
  return texts.join(' ').trim().split(/\s+/).filter(Boolean).length;
}

/** Words in a story: the plain-text opening plus the HTML body. */
export const storyWords = (b: Pick<BlogPost, 'blogp1' | 'blogp2'>) => wordCount(b.blogp1, textOf(b.blogp2));

/** Minutes to read at ~200 words per minute (at least 1). */
export const readingTime = (b: Pick<BlogPost, 'blogp1' | 'blogp2'>) => Math.max(1, Math.round(storyWords(b) / 200));

export const initials = (name: string) =>
  (name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();

/** Stable hue (0-359) derived from a name, used for avatar gradients. */
export function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** "Tue, 3 Nov, 09:30" style label for a schedule time. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
