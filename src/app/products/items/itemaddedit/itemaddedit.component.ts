import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AppService } from '../../../services/app.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppImports } from '../../../app.imports';

// ItemType enum matching backend
export enum ItemType {
    Recipe = 1,
    Ingredient = 2,
    Retail = 3,
    Combo = 4,
    Service = 5
}

@Component({
    selector: 'app-itemaddedit',
    templateUrl: './itemaddedit.component.html',
    standalone: true,
    imports: [AppImports]
})
export class ItemAddEditComponent implements OnInit, OnDestroy {

    // Component state flags
    public isLoading = true;
    public isSubmitted = false;
    public isValidated = false;
    public isEditMode = false;

    // Item data model with inner objects matching controller structure
    public item: any = {
        id: 0,
        categoryId: null,
        taxRateId: null,
        discountId: null,
        itemName: '',
        description: '',
        itemType: ItemType.Recipe,
        price: '',
        cost: '',
        unitOfMeasure: '',
        sku: '',
        barcode: '',
        preparationTime: 0,
        isFeatured: false,
        isActive: true,
        // Inner objects arrays
        itemImages: [],
        recipeItemItems: [],
        comboItemParentItems: [],
        itemModifiers: [],
        // Stock data for create mode
        stocks: []
    };

    // Image handling
    public selectedImageFiles: File[] = [];
    public imagePreviewUrls: string[] = [];
    public imagesToDelete: number[] = [];

    // Dropdown data sources
    public categories: any[] = [];
    public taxRates: any[] = [];
    public discounts: any[] = [];
    public ingredients: any[] = [];
    public productItems: any[] = [];
    public modifiers: any[] = [];
    public itemTypes: any[] = [];
    public locations: any[] = [];

    // Stock management (for create mode only)
    public showStockSection = false;

    // ItemType enum for template
    public ItemType = ItemType;

    constructor(
        private http: HttpClient,
        private route: ActivatedRoute,
        private router: Router,
        public app: AppService
    ) {
        this.initializeItemTypes();
    }

    // Lifecycle hooks
    ngOnInit(): void {
        this.checkRouteParams();
        this.loadLocations();
    }

    ngOnDestroy(): void {
        // Clean up any temporary URLs
        this.imagePreviewUrls.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
    }

    // --- Initialization Methods ---

    // Initialize item types with localization
    private initializeItemTypes(): void {
        this.itemTypes = [
            { value: ItemType.Recipe, label: this.app.localize('Recipe') },
            { value: ItemType.Ingredient, label: this.app.localize('Ingredient') },
            { value: ItemType.Retail, label: this.app.localize('Retail') },
            { value: ItemType.Combo, label: this.app.localize('Combo') },
            { value: ItemType.Service, label: this.app.localize('Service') }
        ];
    }

    // Load locations for stock management
    private loadLocations(): void {
        this.http.get<any>('/api/settings/getlocations').subscribe({
            next: (response) => {
                this.locations = response.data || [];
            },
            error: (error) => {
                console.warn('Failed to load locations:', error);
                // Use default location if service fails
                this.locations = [{ id: 1, locationName: 'Main Location' }];
            }
        });
    }

    // Check route parameters and determine mode
    private checkRouteParams(): void {
        const itemId = Number(this.route.snapshot.paramMap.get('id'));

        if (itemId && itemId > 0) {
            this.isEditMode = true;
            this.item.id = itemId;
            this.loadItemData(itemId);
        } else {
            this.isEditMode = false;
            this.loadFormData();
        }
    }

    // Load dropdown data for form
    private loadFormData(): void {
        this.http.get<any>('/api/products/getitemformdata').subscribe({
            next: (data) => {
                this.categories = data.categories || [];
                this.taxRates = data.taxRates || [];
                this.discounts = data.discounts || [];
                this.ingredients = data.ingredients || [];
                this.productItems = data.productsItems || [];
                this.modifiers = data.modifiers || [];

                // Format display names for dropdown
                this.taxRates.forEach(tr => {
                    tr.displayName = `${tr.taxName} (${tr.isPercentage ? this.app.formatPercent(tr.taxValue) : this.app.formatCurrency(tr.taxValue)})`;
                });

                this.discounts.forEach(d => {
                    d.displayName = `${d.discountName} (${d.isPercentage ? this.app.formatPercent(d.discountValue) : this.app.formatCurrency(d.discountValue)})`;
                });

                this.productItems.forEach(pi => {
                    pi.displayName = `${pi.itemName} (${this.getItemTypeLabel(pi.itemType)} - ${this.app.formatCurrency(pi.price)})`;
                });

                this.isLoading = false;

                setTimeout(() => {
                    this.app.loadImages('[data-form-img="true"]');
                }, 100);
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isLoading = false;
            }
        });
    }

    // Load existing item data for editing
    private loadItemData(itemId: number): void {
        this.http.get<any>(`/api/products/getitem/${itemId}`).subscribe({
            next: (response) => {
                const itemData = response.item;

                this.item = {
                    id: itemData.id,
                    categoryId: itemData.categoryId,
                    taxRateId: itemData.taxRateId,
                    discountId: itemData.discountId,
                    itemName: itemData.itemName,
                    description: itemData.description || '',
                    itemType: itemData.itemType,
                    price: this.app.apiNumberToLocale(itemData.price),
                    cost: this.app.apiNumberToLocale(itemData.cost),
                    unitOfMeasure: itemData.unitOfMeasure || '',
                    sku: itemData.sku || '',
                    barcode: itemData.barcode || '',
                    preparationTime: itemData.preparationTime,
                    isFeatured: itemData.isFeatured,
                    isActive: itemData.isActive,
                    isStockItem: itemData.isStockItem,

                    // Map inner objects with proper structure
                    itemImages: itemData.itemImages?.map((img: any) => ({
                        id: img.id,
                        imageUrl: img.imageUrl ? `/api/media/getthumbnailimage/items/${img.imageUrl}` : 'assets/images/default.png'
                    })) || [],

                    recipeItemItems: itemData.recipeItemItems?.map((ri: any) => ({
                        id: ri.id,
                        itemId: ri.itemId,
                        ingredientId: ri.ingredientId,
                        quantity: this.app.apiNumberToLocale(ri.quantity),
                        ingredient: ri.ingredient
                    })) || [],

                    comboItemParentItems: itemData.comboItemParentItems?.map((ci: any) => ({
                        id: ci.id,
                        parentItemId: ci.parentItemId,
                        childItemId: ci.childItemId,
                        quantity: this.app.apiNumberToLocale(ci.quantity),
                        priceAdjustment: this.app.apiNumberToLocale(ci.priceAdjustment || 0),
                        childItem: ci.childItem
                    })) || [],

                    itemModifiers: itemData.itemModifiers?.map((im: any) => ({
                        id: im.id,
                        itemId: im.itemId,
                        modifierId: im.modifierId,
                        minSelection: im.minSelection,
                        maxSelection: im.maxSelection,
                        isRequired: im.isRequired,
                        modifier: im.modifier
                    })) || [],

                    stocks: [] // Not needed in edit mode
                };

                this.loadFormData();
            },
            error: (error) => {
                this.app.handleApiError(error);
            }
        });
    }

    private resetFormData(): void {
        // Revoke any created object URLs for previews
        this.imagePreviewUrls.forEach(url => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });

        // Clear image selections and related state
        this.selectedImageFiles = [];
        this.imagePreviewUrls = [];
        this.imagesToDelete = [];

        // Reset form flags
        this.isSubmitted = false;
        this.isValidated = false;
        this.isEditMode = false;
        this.showStockSection = false;

        this.item = {
            id: 0,
            categoryId: null,
            taxRateId: null,
            discountId: null,
            itemName: '',
            description: '',
            itemType: ItemType.Recipe,
            price: '',
            cost: '',
            unitOfMeasure: '',
            sku: '',
            barcode: '',
            preparationTime: 0,
            isFeatured: false,
            isActive: true,
            isStockItem: true,
            itemImages: [],
            recipeItemItems: [],
            comboItemParentItems: [],
            itemModifiers: [],
            stocks: []
        };
    }

    // --- Item Type Change Handler ---

    // Handle item type change
    public onItemTypeChange(): void {
        // Clear type-specific data when type changes
        if (this.item.itemType !== ItemType.Recipe) {
            this.item.recipeItemItems = [];
        }
        if (this.item.itemType !== ItemType.Combo) {
            this.item.comboItemParentItems = [];
        }
        if (this.item.itemType !== ItemType.Recipe && this.item.itemType !== ItemType.Retail) {
            this.item.itemModifiers = [];
        }

        // Set default values based on item type
        if (this.item.itemType === ItemType.Ingredient) {
            this.item.categoryId = null;
        }

        // Show/hide stock section for create mode
        this.showStockSection = !this.isEditMode && this.requiresStock();
    }

    // --- Stock Management (Create Mode Only) ---

    // Add initial stock entry
    public addInitialStock(locationId: number): void {
        if (!locationId) return;

        // Check if stock already exists
        if (this.item.stocks.some((s: any) => s.locationId === locationId)) {
            return;
        }

        const location = this.locations.find(l => l.id === locationId);
        if (location) {
            this.item.stocks.push({
                locationId: locationId,
                currentStock: '1',
                averageCost: this.item.cost || '0',
                minLevel: '0',
            });
        }
    }

    // Remove stock entry
    public removeStock(index: number): void {
        this.item.stocks.splice(index, 1);
    }

    // Get location name by ID
    public getLocationName(locationId: number): string {
        const location = this.locations.find(l => l.id === locationId);
        return location ? location.locationName : 'Unknown Location';
    }

    // --- Recipe Items Management with ng-select ---

    // Add new recipe item using ng-select
    public addRecipeItemFromSelect(ingredientId: any): void {
        if (!ingredientId) return;

        // Check if ingredient already exists
        if (this.item.recipeItemItems.some((ri: any) => ri.ingredientId === ingredientId)) {
            this.app.showWarningMessage(
                this.app.localize('Warning'),
                this.app.localize('This ingredient is already added.')
            );
            return;
        }

        const ingredient = this.ingredients.find(i => i.id === ingredientId);
        if (ingredient) {
            this.item.recipeItemItems.push({
                id: 0,
                itemId: this.item.id,
                ingredientId: ingredientId,
                quantity: this.app.apiNumberToLocale(1),
                ingredient: ingredient
            });
        }
    }

    // Remove recipe item
    public removeRecipeItem(index: number): void {
        if (this.item.recipeItemItems.length > 0) {
            this.item.recipeItemItems.splice(index, 1);
        }
    }

    // Update ingredient selection
    public onIngredientChange(recipeItem: any, ingredientId: any): void {
        const ingredient = this.ingredients.find(i => i.id === ingredientId);
        recipeItem.ingredientId = ingredientId;
        recipeItem.ingredient = ingredient;
    }

    // --- Combo Items Management with ng-select ---

    // Add new combo item using ng-select
    public addComboItem(itemId: any): void {
        if (!itemId) return;

        // Check if item already exists
        if (this.item.comboItemParentItems.some((ci: any) => ci.childItemId === itemId)) {
            this.app.showWarningMessage(
                this.app.localize('Warning!'),
                this.app.localize('This item is already added.')
            );
            return;
        }

        const productItem = this.productItems.find(i => i.id === itemId);
        if (productItem) {
            this.item.comboItemParentItems.push({
                id: 0,
                parentItemId: this.item.id,
                childItemId: itemId,
                quantity: this.app.apiNumberToLocale(1),
                priceAdjustment: this.app.apiNumberToLocale(0),
                childItem: productItem
            });
        }
    }

    // Remove combo item
    public removeComboItem(index: number): void {
        if (this.item.comboItemParentItems.length > 0) {
            this.item.comboItemParentItems.splice(index, 1);
        }
    }

    // Update combo item selection
    public onComboItemChange(comboItem: any, itemId: any): void {
        const productItem = this.productItems.find(i => i.id === itemId);
        comboItem.childItemId = itemId;
        comboItem.childItem = productItem;
    }

    // --- Modifier Groups Management with ng-select ---

    // Add modifier group using ng-select
    public addModifierFromSelect(modifierId: any): void {
        if (!modifierId) return;

        // Check if modifier already exists
        if (this.item.itemModifiers.some((im: any) => im.modifierId === modifierId)) {
            this.app.showWarningMessage(
                this.app.localize('Warning!'),
                this.app.localize('This modifier is already added.')
            );
            return;
        }

        const modifier = this.modifiers.find(m => m.id === modifierId);
        if (modifier) {
            this.item.itemModifiers.push({
                id: 0,
                itemId: this.item.id,
                modifierId: modifierId,
                minSelection: modifier.minSelection || 0,
                maxSelection: modifier.maxSelection || 1,
                isRequired: modifier.isRequired || false,
                modifier: modifier
            });
        }
    }

    // Remove modifier group
    public removeModifier(index: number): void {
        this.item.itemModifiers.splice(index, 1);
    }

    // Get modifier options display text
    public getModifierOptionsText(modifier: any): string {
        if (modifier && modifier.modifierOptions) {
            // Check if it's already a string (from API projection)
            if (typeof modifier.modifierOptions === 'string') {
                return modifier.modifierOptions;
            }
            // If it's an array, join the option names
            if (Array.isArray(modifier.modifierOptions)) {
                return modifier.modifierOptions.map((option: any) => option.optionName || option).join(', ');
            }
        }
        return '';
    }

    // --- Image Handling Methods ---

    // Handle multiple image file selection
    public onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        const files = Array.from(input.files);

        for (const file of files) {
            if (!this.validateImageFile(file)) continue;

            if (this.selectedImageFiles.find(f => f.name === file.name && f.size === file.size)) {
                continue; // Skip duplicate files
            }

            this.selectedImageFiles.push(file);
            const previewUrl = URL.createObjectURL(file);
            this.imagePreviewUrls.push(previewUrl);
        }

        input.value = '';

        setTimeout(() => {
            this.app.loadImages('[data-form-img="true"]');
        }, 100);
    }

    // Validate image file
    private validateImageFile(file: File): boolean {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const maxSizeMB = 5;

        if (!allowedTypes.includes(file.type)) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('Please select a valid image file (JPG, PNG, WebP, GIF).')
            );
            return false;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            this.app.showErrorMessage(
                this.app.localize('Error!'),
                this.app.localize('File size must be less than 5MB.')
            );
            return false;
        }

        return true;
    }

    // Remove selected image
    public removeSelectedImage(index: number): void {
        const url = this.imagePreviewUrls[index];
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
        this.selectedImageFiles.splice(index, 1);
        this.imagePreviewUrls.splice(index, 1);
    }

    // Remove existing image
    public removeExistingImage(imageId: number, index: number): void {
        this.imagesToDelete.push(imageId);
        this.item.itemImages.splice(index, 1);
    }

    // Drag and drop reorder images
    public dropImage(event: CdkDragDrop<any[]>): void {
        if (event.container === event.previousContainer) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        }
    }

    // --- Form Submission Methods ---

    // Handle form submission
    public submitForm(form: NgForm): void {
        this.isValidated = true;

        if (!form.valid) {
            return;
        }

        // Additional custom validations
        if (!this.validateItemData()) {
            return;
        }

        this.isSubmitted = true;

        const url = this.isEditMode
            ? `/api/products/updateitem/${this.item.id}`
            : '/api/products/createitem';

        // Create FormData for file upload
        const formData = this.prepareFormData();

        const request$ = this.isEditMode
            ? this.http.put<any>(url, formData)
            : this.http.post<any>(url, formData);

        request$.subscribe({
            next: (response) => {
                const successMessage = this.isEditMode
                    ? this.app.localize('Item updated successfully.')
                    : this.app.localize('Item created successfully.');

                this.app.showSuccessMessage(this.app.localize('Success!'), successMessage);

                if (!this.isEditMode) {
                    this.resetFormData();
                }
                this.isValidated = false;
                this.isSubmitted = false;
            },
            error: (error) => {
                this.app.handleApiError(error);
                this.isSubmitted = false;
            }
        });
    }

    // Validate item data before submission
    private validateItemData(): boolean {
        // Validate recipe items
        if (this.item.itemType === ItemType.Recipe) {
            if (this.item.recipeItemItems.length === 0) {
                this.app.showErrorMessage(
                    this.app.localize('Error!'),
                    this.app.localize('Recipe items must include at least one ingredient.')
                );
                return false;
            }

            // Check if all ingredients are selected
            if (this.item.recipeItemItems.some((ri: any) => !ri.ingredientId)) {
                this.app.showErrorMessage(
                    this.app.localize('Error!'),
                    this.app.localize('Please select all ingredients for recipe items.')
                );
                return false;
            }
        }

        // Validate combo items
        if (this.item.itemType === ItemType.Combo) {
            if (this.item.comboItemParentItems.length === 0) {
                this.app.showErrorMessage(
                    this.app.localize('Error!'),
                    this.app.localize('Combo items must include at least one product item.')
                );
                return false;
            }

            // Check if all combo items are selected
            if (this.item.comboItemParentItems.some((ci: any) => !ci.childItemId)) {
                this.app.showErrorMessage(
                    this.app.localize('Error!'),
                    this.app.localize('Please select all items for combo.')
                );
                return false;
            }
        }

        // Validate stock data for create mode
        if (!this.isEditMode && this.requiresStock() && this.item.stocks.length > 0) {
            for (let i = 0; i < this.item.stocks.length; i++) {
                const stock = this.item.stocks[i];
                const currentStock = this.app.localeToAPINumber(stock.currentStock || '0');

                if (currentStock <= 0) {
                    this.app.showErrorMessage(
                        this.app.localize('Error!'),
                        this.app.localize('Initial stock quantity must be greater than 0.')
                    );
                    return false;
                }

                const avgCost = this.app.localeToAPINumber(stock.averageCost || '0');
                if (avgCost <= 0) {
                    this.app.showErrorMessage(
                        this.app.localize('Error!'),
                        this.app.localize('Average cost must be greater than 0.')
                    );
                    return false;
                }
            }
        }

        return true;
    }

    // Prepare FormData for submission
    private prepareFormData(): FormData {
        const formData = new FormData();

        const categoryId = this.categoryRequired() ? this.item.categoryId : 1;
        // Add item data
        formData.append('item.id', this.item.id.toString());
        if (categoryId) formData.append('item.categoryId', categoryId.toString());
        if (this.item.taxRateId) formData.append('item.taxRateId', this.item.taxRateId.toString());
        if (this.item.discountId) formData.append('item.discountId', this.item.discountId.toString());
        formData.append('item.itemType', this.item.itemType.toString());
        formData.append('item.itemName', this.item.itemName);
        formData.append('item.description', this.item.description || '');
        formData.append('item.price', this.app.localeToAPINumber(this.item.price || '0').toString());
        formData.append('item.cost', this.app.localeToAPINumber(this.item.cost || '0').toString());
        formData.append('item.unitOfMeasure', this.item.unitOfMeasure || '');
        formData.append('item.sku', this.item.sku || '');
        formData.append('item.barcode', this.item.barcode || '');
        formData.append('item.preparationTime', this.item.preparationTime.toString());
        formData.append('item.isFeatured', this.item.isFeatured.toString());
        formData.append('item.isActive', this.item.isActive.toString());

        // Add new image files
        this.selectedImageFiles.forEach(file => {
            formData.append('imageFiles', file);
        });

        // Add images to delete for edit mode
        if (this.isEditMode && this.imagesToDelete.length > 0) {
            this.imagesToDelete.forEach(imageId => {
                formData.append('imagesToDelete', imageId.toString());
            });
        }

        // Add recipe items
        this.item.recipeItemItems.forEach((recipeItem: any, index: number) => {
            if (recipeItem.ingredientId) {
                formData.append(`recipeItemItems[${index}].ingredientId`, recipeItem.ingredientId.toString());
                formData.append(`recipeItemItems[${index}].quantity`, this.app.localeToAPINumber(recipeItem.quantity).toString());
            }
        });

        // Add combo items
        this.item.comboItemParentItems.forEach((comboItem: any, index: number) => {
            if (comboItem.childItemId) {
                formData.append(`comboItemChildItems[${index}].childItemId`, comboItem.childItemId.toString());
                formData.append(`comboItemChildItems[${index}].quantity`, this.app.localeToAPINumber(comboItem.quantity).toString());
                formData.append(`comboItemChildItems[${index}].priceAdjustment`, this.app.localeToAPINumber(comboItem.priceAdjustment).toString());
            }
        });

        // Add modifier groups
        this.item.itemModifiers.forEach((itemModifier: any, index: number) => {
            if (itemModifier.modifierId) {
                formData.append(`itemModifiers[${index}].modifierId`, itemModifier.modifierId.toString());
                formData.append(`itemModifiers[${index}].minSelection`, itemModifier.minSelection.toString());
                formData.append(`itemModifiers[${index}].maxSelection`, itemModifier.maxSelection.toString());
                formData.append(`itemModifiers[${index}].isRequired`, itemModifier.isRequired.toString());
            }
        });

        // Add stock data for create mode
        if (!this.isEditMode && this.requiresStock()) {
            this.item.stocks.forEach((stock: any, index: number) => {
                if (stock.currentStock && this.app.localeToAPINumber(stock.currentStock) > 0) {
                    formData.append(`stocks[${index}].locationId`, stock.locationId.toString());
                    formData.append(`stocks[${index}].currentStock`, this.app.localeToAPINumber(stock.currentStock).toString());
                    formData.append(`stocks[${index}].averageCost`, this.app.localeToAPINumber(stock.averageCost || '0').toString());
                    formData.append(`stocks[${index}].minLevel`, this.app.localeToAPINumber(stock.minLevel || '0').toString());
                    if (stock.maxLevel) {
                        formData.append(`stocks[${index}].maxLevel`, this.app.localeToAPINumber(stock.maxLevel).toString());
                    }
                }
            });
        }

        return formData;
    }

    // --- Utility Methods ---

    // Get page title
    public getPageTitle(): string {
        return this.isEditMode
            ? this.app.localize('Edit Item')
            : this.app.localize('Add Item');
    }

    // Check if category is required
    public categoryRequired(): boolean {
        return this.item.itemType !== ItemType.Ingredient;
    }

    // Check if item requires price
    public requiresPrice(): boolean {
        return this.item.itemType !== ItemType.Ingredient && this.item.itemType !== ItemType.Combo;
    }

    // Check if item requires cost
    public requiresCost(): boolean {
        return this.item.itemType === ItemType.Ingredient ||
            this.item.itemType === ItemType.Retail ||
            this.item.itemType === ItemType.Service;
    }

    // Check if item requires unit of measure
    public requiresUnit(): boolean {
        return this.item.itemType === ItemType.Ingredient ||
            this.item.itemType === ItemType.Recipe ||
            this.item.itemType === ItemType.Retail;
    }

    // Check if item requires tax and discount
    public requiresTaxAndDiscount(): boolean {
        return this.item.itemType !== ItemType.Ingredient;
    }

    // Check if item requires preparation time
    public requiresPreparationTime(): boolean {
        return this.item.itemType === ItemType.Recipe;
    }

    // Check if item requires modifiers
    public requiresModifiers(): boolean {
        return this.item.itemType === ItemType.Recipe ||
            this.item.itemType === ItemType.Retail;
    }

    // Check if item requires ingredients (Recipe type)
    public requiresIngredients(): boolean {
        return this.item.itemType === ItemType.Recipe;
    }

    // Check if item requires combo items (Combo type)
    public requiresComboItems(): boolean {
        return this.item.itemType === ItemType.Combo;
    }

    // Check if item requires stock management
    public requiresStock(): boolean {
        return this.item.itemType === ItemType.Ingredient ||
            this.item.itemType === ItemType.Retail;
    }

    // Get item type label
    public getItemTypeLabel(itemType: number): string {
        const type = this.itemTypes.find(t => t.value === itemType);
        return type ? type.label : '';
    }

    // Get total image count
    public getTotalImageCount(): number {
        return this.item.itemImages.length + this.imagePreviewUrls.length;
    }
}