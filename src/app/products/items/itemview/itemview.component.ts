import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AppService } from '../../../services/app.service';
import { AppImports } from '../../../app.imports';

@Component({
	selector: 'app-itemview',
	templateUrl: './itemview.component.html',
	standalone: true,
	imports: [AppImports]
})
export class ItemViewComponent implements OnInit, OnDestroy {

	// Item details
	public item: any;
	public loading: boolean = true;
	public activeTab: string = 'details';

	// Image gallery
	public selectedImageIndex: number = 0;

	// Item type labels
	public itemTypes: any[] = [
		{ value: 1, label: 'Recipe', badge: 'primary' },
		{ value: 2, label: 'Ingredient', badge: 'warning' },
		{ value: 3, label: 'Retail', badge: 'info' },
		{ value: 4, label: 'Combo', badge: 'dark' },
		{ value: 5, label: 'Service', badge: 'light' }
	];

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private http: HttpClient,
		public app: AppService
	) {
		this.itemTypes.forEach(type => {
			type.label = this.app.localize(type.label);
		});
	}

	// Lifecycle hooks
	ngOnInit(): void {
		// Get item ID from route parameter
		const itemId = this.route.snapshot.paramMap.get('id');
		if (itemId) {
			this.loadItemDetails(parseInt(itemId));
		}
	}

	ngOnDestroy(): void {
	}

	// --- Data Loading Methods ---

	// Load item details from API
	private loadItemDetails(itemId: number): void {
		this.loading = true;
		this.http.get<any>(`/api/products/getitem/${itemId}`).subscribe({
			next: response => {
				this.item = response.item;
				
				// Process images for display
				if (this.item.itemImages && this.item.itemImages.length > 0) {
					this.item.itemImages = this.item.itemImages.map((img: any) => ({
						...img,
						imageUrl: `/api/media/getimage/items/${img.imageUrl}`,
						thumbnailUrl: `/api/media/getthumbnailimage/items/${img.imageUrl}`
					}));
				}

				this.loading = false;

				// Load images after data is loaded
				setTimeout(() => {
					this.app.loadImages('[data-gallery-img="true"]');
				}, 100);
			},
			error: error => {
				this.app.handleApiError(error);
				this.loading = false;
			}
		});
	}

	// --- Image Gallery Methods ---

	// Select image for main display
	public selectImage(index: number): void {
		this.selectedImageIndex = index;
		this.app.loadImages('[data-gallery-img="true"]');
	}

	// Get current selected image
	public getCurrentImage(): any {
		if (this.hasImages()) {
			return this.item.itemImages[this.selectedImageIndex];
		}
		return { imageUrl: 'assets/images/default.png', thumbnailUrl: 'assets/images/default.png' };
	}

	// Navigate to previous image
	public previousImage(): void {
		if (this.hasImages()) {
			this.selectedImageIndex = this.selectedImageIndex > 0 
				? this.selectedImageIndex - 1 
				: this.item.itemImages.length - 1;
			this.app.loadImages('[data-gallery-img="true"]');
		}
	}

	// Navigate to next image
	public nextImage(): void {
		if (this.hasImages()) {
			this.selectedImageIndex = this.selectedImageIndex < this.item.itemImages.length - 1 
				? this.selectedImageIndex + 1 
				: 0;
			this.app.loadImages('[data-gallery-img="true"]');
		}
	}

	// --- Tab Management ---

	// Set active tab
	public setActiveTab(tab: string): void {
		this.activeTab = tab;
	}

	// Check if tab is active
	public isTabActive(tab: string): boolean {
		return this.activeTab === tab;
	}

	// Get available tabs based on item type
	public getAvailableTabs(): string[] {
		const tabs = ['details'];
		
		if (this.hasRecipeItems()) {
			tabs.push('recipe');
		}
		
		if (this.hasComboItems()) {
			tabs.push('combo');
		}
		
		if (this.hasModifiers()) {
			tabs.push('modifiers');
		}

		return tabs;
	}

	// --- Utility Methods ---

	// Get item type label
	public getItemTypeLabel(itemType: number): string {
		const type = this.itemTypes.find(t => t.value === itemType);
		return type ? type.label : '';
	}

	// Get item type badge class
	public getItemTypeBadge(itemType: number): string {
		const type = this.itemTypes.find(t => t.value === itemType);
		return type ? type.badge : 'light';
	}

	// Check if item has images
	public hasImages(): boolean {
		return this.item?.itemImages && this.item.itemImages.length > 0;
	}

	// Check if item has recipe items (ingredients)
	public hasRecipeItems(): boolean {
		return this.item?.recipeItemItems && this.item.recipeItemItems.length > 0;
	}

	// Check if item has combo items
	public hasComboItems(): boolean {
		return this.item?.comboItemParentItems && this.item.comboItemParentItems.length > 0;
	}

	// Check if item has modifiers
	public hasModifiers(): boolean {
		return this.item?.itemModifiers && this.item.itemModifiers.length > 0;
	}

	// Calculate total recipe cost
	public getRecipeTotalCost(): number {
		if (!this.hasRecipeItems()) return 0;
		
		return this.item.recipeItemItems.reduce((total: number, recipeItem: any) => {
			const cost = recipeItem.ingredient?.cost || 0;
			return total + (cost * recipeItem.quantity);
		}, 0);
	}

	// Calculate combo total price
	public getComboTotalPrice(): number {
		if (!this.hasComboItems()) return 0;
		
		return this.item.comboItemParentItems.reduce((total: number, comboItem: any) => {
			const price = comboItem.childItem?.price || 0;
			const adjustment = comboItem.priceAdjustment || 0;
			return total + ((price + adjustment) * comboItem.quantity);
		}, 0);
	}

	// Format item status
	public getStatusBadge(): { class: string, text: string } {
		if (this.item?.isActive) {
			return { class: 'badge-primary', text: this.app.localize('Active') };
		} else {
			return { class: 'badge-secondary', text: this.app.localize('Inactive') };
		}
	}

	// Get featured badge
	public getFeaturedBadge(): { class: string, text: string } | null {
		if (this.item?.isFeatured) {
			return { class: 'badge-warning', text: this.app.localize('Featured') };
		}
		return null;
	}

	// Get stock item badge
	public getStockBadge(): { class: string, text: string } | null {
		if (this.item?.isStockItem) {
			return { class: 'badge-info', text: this.app.localize('Stock Item') };
		}
		return null;
	}
}