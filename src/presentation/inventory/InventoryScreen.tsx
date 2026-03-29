import { useState, useRef, ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product } from '../../data/database';
import { Plus, Search, Edit2, Trash2, PackageOpen, ImageIcon, Upload } from 'lucide-react';
import { cn } from '../../core/utils/cn';
import { ProductModal } from './components/ProductModal';
import * as XLSX from 'xlsx';

export function InventoryScreen() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray()) || [];
  const products = useLiveQuery(() => {
    if (searchQuery) {
      return db.products
        .where('name')
        .startsWithIgnoreCase(searchQuery)
        .toArray();
    }
    return db.products.toArray();
  }, [searchQuery]) || [];

  const handleAddCategory = async () => {
    const name = prompt('Enter category name:');
    if (name) {
      await db.categories.add({
        name,
        color: '#007AFF',
        icon: 'folder',
        sortOrder: categories.length,
      });
    }
  };

  const handleAddProduct = () => {
    if (categories.length === 0) {
      alert('Please add a category first.');
      return;
    }
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('Delete this product?')) {
      await db.products.delete(id);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Delete this category?')) {
      await db.categories.delete(id);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let importedCount = 0;
      // Keep a local cache of categories to avoid duplicates during the loop
      const localCategories = [...categories];

      for (const row of jsonData as any[]) {
        const name = row['Name'] || row['name'];
        const price = parseFloat(row['Price'] || row['price'] || '0');
        const categoryName = row['Category'] || row['category'] || 'Uncategorized';
        const stockQty = parseInt(row['Stock'] || row['stock'] || '100', 10);
        const hsnCode = row['HSN'] || row['hsnCode'] || '';

        if (!name) continue;

        let category = localCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        let categoryId = category?.id;

        if (!category) {
          categoryId = await db.categories.add({
            name: categoryName,
            color: '#007AFF',
            icon: 'folder',
            sortOrder: localCategories.length,
          }) as number;
          localCategories.push({ id: categoryId, name: categoryName, color: '#007AFF', icon: 'folder', sortOrder: localCategories.length });
        }

        await db.products.add({
          name: name.toString(),
          price: isNaN(price) ? 0 : price,
          categoryId: categoryId!,
          stockQty: isNaN(stockQty) ? 0 : stockQty,
          hsnCode: hsnCode.toString(),
          imagePath: '',
          isAvailable: true,
          taxRate: 0,
          createdAt: new Date()
        });
        importedCount++;
      }

      alert(`Successfully imported ${importedCount} products!`);
    } catch (error: any) {
      console.error("Import error:", error);
      alert("Failed to import file: " + error.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'products' && (
            <>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex-1 sm:flex-none justify-center bg-white text-[#007AFF] px-4 py-2 rounded-xl font-semibold flex items-center gap-2 active:scale-95 transition-transform shadow-sm disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import'}</span>
                <span className="sm:hidden">{isImporting ? '...' : 'Import'}</span>
              </button>
            </>
          )}
          <button
            onClick={activeTab === 'products' ? handleAddProduct : handleAddCategory}
            className="flex-1 sm:flex-none justify-center bg-[#007AFF] text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add {activeTab === 'products' ? 'Product' : 'Category'}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="bg-[#E3E3E8] p-1 rounded-xl flex mb-6">
        <button
          onClick={() => setActiveTab('products')}
          className={cn(
            'flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all',
            activeTab === 'products' ? 'bg-white shadow-sm text-black' : 'text-[#6E6E73]'
          )}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            'flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all',
            activeTab === 'categories' ? 'bg-white shadow-sm text-black' : 'text-[#6E6E73]'
          )}
        >
          Categories
        </button>
      </div>

      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E6E73]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-none rounded-xl pl-10 pr-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.05)] focus:ring-2 focus:ring-[#007AFF] outline-none"
            />
          </div>

          {products.length === 0 ? (
             <div className="text-center py-12 text-[#6E6E73]">
               <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
               <p>No products found.</p>
             </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className={cn(
                    'flex items-center justify-between p-4',
                    index !== products.length - 1 && 'border-b border-[#C6C6C8]/50'
                  )}
                >
                  <div className="flex items-center gap-4">
                    {product.imagePath ? (
                      <img src={product.imagePath} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-[#F2F2F7]" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#F2F2F7] flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-[#C6C6C8]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      <p className="text-sm text-[#6E6E73]">
                        ₹{product.price.toFixed(2)} • Stock: {product.stockQty}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleEditProduct(product)}
                      className="p-2 text-[#007AFF] hover:bg-[#007AFF]/10 rounded-full transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id!)}
                      className="p-2 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-full transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
          {categories.length === 0 ? (
             <div className="text-center py-12 text-[#6E6E73]">
               <p>No categories found.</p>
             </div>
          ) : (
            categories.map((category, index) => (
              <div
                key={category.id}
                className={cn(
                  'flex items-center justify-between p-4',
                  index !== categories.length - 1 && 'border-b border-[#C6C6C8]/50'
                )}
              >
                <h3 className="font-semibold text-lg">{category.name}</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDeleteCategory(category.id!)}
                    className="p-2 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-full transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ProductModal 
        isOpen={isProductModalOpen} 
        onClose={() => setIsProductModalOpen(false)} 
        product={editingProduct}
        categories={categories}
      />
    </div>
  );
}
