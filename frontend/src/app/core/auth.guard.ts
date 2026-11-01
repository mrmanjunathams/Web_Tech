import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/** Lets signed-in users through; sends everyone else to the sign-in page. */
export const authGuard: CanActivateFn = async () => {
  const user = await inject(Auth).load();
  return user ? true : inject(Router).createUrlTree(['/login']);
};
