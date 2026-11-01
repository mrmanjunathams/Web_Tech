import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', title: 'Bloggerbytes', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  { path: 'blog', title: 'Blog | Bloggerbytes', loadComponent: () => import('./pages/blog').then((m) => m.Blog) },
  { path: 'cate', title: 'Categories | Bloggerbytes', loadComponent: () => import('./pages/category').then((m) => m.Category) },
  { path: 'rewards', title: 'Rewards | Bloggerbytes', loadComponent: () => import('./pages/rewards').then((m) => m.Rewards) },
  { path: 'gallery', title: 'Image Pool | Bloggerbytes', loadComponent: () => import('./pages/gallery').then((m) => m.Gallery) },
  { path: 'aboutme', title: 'About Us | Bloggerbytes', loadComponent: () => import('./pages/about').then((m) => m.About) },
  { path: 'login', title: 'Sign In | Bloggerbytes', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'signup', title: 'Sign Up | Bloggerbytes', loadComponent: () => import('./pages/signup').then((m) => m.Signup) },
  { path: 'myacc', title: 'My Account | Bloggerbytes', canActivate: [authGuard], loadComponent: () => import('./pages/account').then((m) => m.Account) },
  { path: 'writeblog', title: 'Write | Bloggerbytes', canActivate: [authGuard], loadComponent: () => import('./pages/write').then((m) => m.Write) },
  { path: '**', redirectTo: '' },
];
