import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/** Lets signed-in users through; sends everyone else to the sign-in page. */
export const authGuard: CanActivateFn = async () => {
  // inject() only works before the first await, so resolve both services up front.
  const auth = inject(Auth);
  const router = inject(Router);
  const user = await auth.load();
  return user ? true : router.createUrlTree(['/login']);
};
