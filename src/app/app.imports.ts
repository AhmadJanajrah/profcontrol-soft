// src/app/app.imports.ts
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { DataTablesModule } from 'angular-datatables';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgApexchartsModule } from 'ng-apexcharts';

// Custom directives module
import { SharedDirectivesModule } from '../directive/shareddirectives.module';

export const AppImports = [
  // Angular core
  CommonModule,
  RouterModule,
  FormsModule,
  ReactiveFormsModule,

  // UI / third-party
  DragDropModule,
  DataTablesModule,
  NgSelectModule,
  NgApexchartsModule,

  // ALL directives
  SharedDirectivesModule
];
