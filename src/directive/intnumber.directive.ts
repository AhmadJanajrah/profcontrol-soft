import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: '[appIntegerOnly]',
  standalone: false
})
export class IntegerOnlyDirective {
  private readonly MAX_DIGITS = 10;

  @HostListener('input', ['$event'])
  onInput(event: any) {
    const input = event.target as HTMLInputElement;
    if (!input) { return; }

    const initial = input.value;

    const minAttr = input.getAttribute('min');
    const maxAttr = input.getAttribute('max');
    const minNum = minAttr !== null && minAttr !== '' ? parseInt(minAttr, 10) : NaN;
    const allowNegative = !isNaN(minNum) && minNum < 0;

    let cleaned = allowNegative ? initial.replace(/[^\d-]/g, '') : initial.replace(/\D/g, '');
    if (allowNegative) {
      cleaned = cleaned.replace(/(?!^)-/g, '');
      if ((cleaned.match(/-/g) || []).length > 1) {
        cleaned = cleaned.replace(/-/g, '');
        cleaned = '-' + cleaned;
      }
    }

    if (cleaned !== '') {
      const isNegative = cleaned.startsWith('-');
      const digitsPart = isNegative ? cleaned.slice(1) : cleaned;
      const limitedDigits = digitsPart.slice(0, this.MAX_DIGITS);
      cleaned = isNegative ? '-' + limitedDigits : limitedDigits;
      if (!isNegative && cleaned === '') {
        cleaned = '';
      }
    }

    let final = cleaned;
    if (cleaned !== '' && cleaned !== '-') {
      const num = parseInt(cleaned, 10);
      if (!isNaN(num)) {
        let clamped = num;
        if (minAttr !== null && minAttr !== '' && !isNaN(parseInt(minAttr, 10)) && clamped < parseInt(minAttr, 10)) {
          clamped = parseInt(minAttr, 10);
        }
        if (maxAttr !== null && maxAttr !== '' && !isNaN(parseInt(maxAttr, 10)) && clamped > parseInt(maxAttr, 10)) {
          clamped = parseInt(maxAttr, 10);
        }
        final = clamped.toString();
      } else {
        final = '';
      }
    }

    input.value = final;

    if (initial !== final) {
      event.stopPropagation();
    }
  }
}