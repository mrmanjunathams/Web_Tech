import { TestBed } from '@angular/core/testing';
import { Toast } from './toast';

describe('Toast', () => {
  it('shows and auto-dismisses messages', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(Toast);
    toast.success('Saved');
    toast.error('Oops');
    toast.show('Hi');
    expect(toast.items().map((t) => [t.text, t.kind])).toEqual([['Saved', 'success'], ['Oops', 'error'], ['Hi', 'info']]);
    vi.advanceTimersByTime(3500);
    expect(toast.items().map((t) => t.text)).toEqual(['Oops']);
    vi.advanceTimersByTime(1500);
    expect(toast.items()).toEqual([]);
    vi.useRealTimers();
  });
});
