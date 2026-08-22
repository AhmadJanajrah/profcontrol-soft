import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  HostListener,
  forwardRef
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  ControlValueAccessor,
  Validator,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

declare var Cleave: any;

@Directive({
  selector: '[appCleaveNumber]',
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CleaveNumberDirective),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CleaveNumberDirective),
      multi: true
    }
  ]
})
export class CleaveNumberDirective
  implements AfterViewInit, OnDestroy, ControlValueAccessor, Validator {
  
  @Input('appCleaveNumber') options: any;
  @Input('appCleaveNumberMin') min?: number;
  @Input('appCleaveNumberMax') max?: number;

  private cleaveInstance: any;
  private lastRawValue: string | null = null;
  private isWritingValue = false;
  private currentValue: number | null = null;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {}

  // ... rest of the implementation remains the same
  ngAfterViewInit(): void {
    if (typeof Cleave === 'undefined') {
      console.warn('Cleave.js not loaded.');
      return;
    }

    const defaultOptions = {
      numeral: true,
      numeralDecimalScale: 0,
      numeralPositiveOnly: true,
      ...this.options,
      onValueChanged: this.onValueChanged.bind(this)
    };

    this.cleaveInstance = new Cleave(this.el.nativeElement, defaultOptions);
  }

  private onValueChanged(event: any): void {
    if (this.isWritingValue) return;

    let rawValue = event.target.rawValue;
    if (rawValue !== this.lastRawValue) {
      this.lastRawValue = rawValue;

      let numericValue = rawValue ? parseFloat(rawValue) : null;

      if (numericValue !== null) {
        if (this.min !== undefined && numericValue < this.min) numericValue = this.min;
        if (this.max !== undefined && numericValue > this.max) numericValue = this.max;
      }

      this.currentValue = numericValue;
      this.onChange(numericValue);
    }
  }

  @HostListener('blur')
  handleBlur(): void {
    this.onTouched();
  }

  writeValue(value: any): void {
    if (value === null || value === undefined) value = '';
    if (this.cleaveInstance) {
      this.isWritingValue = true;
      this.cleaveInstance.setRawValue(value.toString());
      this.isWritingValue = false;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (this.currentValue === null || this.currentValue === undefined) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (this.min !== undefined && this.currentValue < this.min) {
      errors['min'] = { min: this.min, actual: this.currentValue };
    }

    if (this.max !== undefined && this.currentValue > this.max) {
      errors['max'] = { max: this.max, actual: this.currentValue };
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  ngOnDestroy(): void {
    if (this.cleaveInstance) {
      this.cleaveInstance.destroy();
    }
  }
}