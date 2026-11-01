import { Component, computed, input } from '@angular/core';
import { hueOf, initials } from '../core/api';

/** Gradient initials avatar; the colours are derived from the name so each writer is recognisable. */
@Component({
  selector: 'app-avatar',
  template: `<span class="avatar" [style.--h]="hue()" [style.width.px]="size()" [style.height.px]="size()"
                   [style.font-size.px]="size() * 0.38" [attr.title]="name()">{{ letters() }}</span>`,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input(36);
  protected readonly letters = computed(() => initials(this.name()));
  protected readonly hue = computed(() => hueOf(this.name()));
}
