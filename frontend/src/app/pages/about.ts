import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal, Tilt } from '../shared/effects';

@Component({
  selector: 'app-about',
  imports: [RouterLink, Reveal, Tilt],
  template: `
    <section class="container-x page-head">
      <p class="eyebrow" reveal>About us</p>
      <h1 class="display display--md" reveal="60">We believe sharing beats <span class="text-grad">searching.</span></h1>
      <p class="lead" reveal="120">
        Bloggerbytes is an all-in-one blogging platform for every kind of writer. We build innovative, beautiful ways to
        represent you — so your passions find the readers they deserve.
      </p>
    </section>

    <section class="container-x section section--tight">
      <div class="about-split">
        <figure class="about-split__img" tilt="4" reveal>
          <span class="spotlight" aria-hidden="true"></span>
          <img src="picyourpic/opt/writing-blogs-1800.webp" alt="Writing at a desk" loading="lazy">
        </figure>
        <div reveal="100">
          <h2 class="h-xl">Our mission</h2>
          <p class="muted">
            There is a better way to market yourself and express what matters to you: a more valuable, less invasive way,
            where people share information instead of hunting for it. We're obsessively passionate about it, and our
            mission is to help people achieve it — across art, science, travel and everything in between.
          </p>
          <p class="muted">
            Great blogging is one of the least understood, least transparent crafts on the web. We see that as an
            opportunity, and we're excited to make it simple for everyone.
          </p>
        </div>
      </div>
    </section>

    <section class="container-x section">
      <header class="section-head" reveal>
        <p class="eyebrow">Our journey</p>
        <h2 class="h-xl">From a student project to a stage for stories</h2>
      </header>
      <ol class="timeline-x">
        @for (m of milestones; track m.year; let i = $index) {
          <li [reveal]="i * 90">
            <span class="timeline-x__year mono">{{ m.year }}</span>
            <div class="glass timeline-x__card">
              <h3>{{ m.title }}</h3>
              <p class="muted">{{ m.text }}</p>
            </div>
          </li>
        }
      </ol>
    </section>

    <section class="container-x section">
      <div class="cta-panel" reveal>
        <div class="cta-panel__glow" aria-hidden="true"></div>
        <h2 class="display display--sm">Say hello</h2>
        <p class="lead">Questions, ideas, or a story you want featured? We read everything.</p>
        <a class="btn-x btn-x--lg" href="mailto:bloggerbytesinfo@gmail.com?subject=Hello%20Bloggerbytes"><span class="ms">mail</span>bloggerbytesinfo&#64;gmail.com</a>
        <a routerLink="/signup" class="link-arrow">or start writing today <span class="ms">arrow_forward</span></a>
      </div>
    </section>
  `,
})
export class About {
  protected readonly milestones = [
    { year: '2018', title: 'The first byte', text: 'Bloggerbytes launches as a web-technology project: a place for anyone to publish.' },
    { year: '2019', title: 'The Image Pool', text: 'Curated photography so every story gets a cover worth stopping for.' },
    { year: '2026', title: 'Reimagined', text: 'A complete rebuild: instant search, live editor, likes, leaderboard, light and dark.' },
    { year: 'Next', title: 'Your story', text: 'The best chapter is the one you are about to write.' },
  ];
}
