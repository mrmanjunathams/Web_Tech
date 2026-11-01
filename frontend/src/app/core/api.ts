import { HttpErrorResponse } from '@angular/common/http';

export interface BlogPost {
  _id?: string;
  auth: string;
  title: string;
  cate: string;
  date: string;
  img: string;
  blogp1: string;
  blogp2: string;
}

export interface Account {
  username: string;
  email: string;
  blogs: BlogPost[];
}

/** Turns an API error into a message suitable for showing to the user. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.error?.error) return err.error.error;
    if (err.status === 0) return 'Cannot reach the server. Is it running?';
  }
  return fallback;
}
