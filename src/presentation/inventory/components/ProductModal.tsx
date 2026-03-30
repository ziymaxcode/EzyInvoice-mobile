import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { db, Product, Category } from '../../../data/database';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../../core/utils/cn';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  categories: Category[];
}

export function ProductModal({ isOpen, onClose, product, categories }: ProductModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [stockQty, setStockQty] = useState('');
  const [imagePath, setImagePath] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price.toString());
      setCategoryId(product.categoryId);
      setStockQty(product.stockQty.toString());
      setImagePath(product.imagePath || '');
    } else {
      setName('');
      setPrice('');
      setCategoryId(categories.length > 0 ? categories[0].id! : '');
      setStockQty('100');
      setImagePath('');
    }
  }, [product, isOpen, categories]);

  if (!isOpen) return null;

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePath(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!name || !price || categoryId === '') {
      alert("Please fill required fields (Name, Price, Category)");
      return;
    }

    const productData = {
      name,
      price: parseFloat(price),
      categoryId: Number(categoryId),
      stockQty: parseInt(stockQty) || 0,
      imagePath,
      taxRate: product?.taxRate || 0,
      hsnCode: product?.hsnCode || '',
      isAvailable: product ? product.isAvailable : true,
      createdAt: product ? product.createdAt : new Date(),
    };

    if (product?.id) {
      await db.products.update(product.id, productData);
    } else {
      await db.products.add(productData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#E3E3E8]">
          <h2 className="text-xl font-bold text-[#1C1C1E]">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-2 bg-[#F2F2F7] hover:bg-[#E3E3E8] rounded-full transition-colors">
            <X className="w-5 h-5 text-[#6E6E73]" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Image Upload */}
          <div className="flex flex-col items-center justify-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 rounded-2xl border-2 border-dashed border-[#C6C6C8] flex flex-col items-center justify-center cursor-pointer hover:bg-[#F2F2F7] transition-colors overflow-hidden relative group"
            >
              {imagePath ? (
                <>
                  <img src={imagePath} alt="Product" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-[#6E6E73] mb-2" />
                  <span className="text-xs font-semibold text-[#6E6E73]">Add Image</span>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Product Name *</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
              placeholder=""
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Price (₹) *</label>
              <input 
                type="number" 
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Stock Qty</label>
              <input 
                type="number" 
                value={stockQty}
                onChange={e => setStockQty(e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Category *</label>
            <select 
              value={categoryId}
              onChange={e => setCategoryId(Number(e.target.value))}
              className="w-full bg-[#F2F2F7] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#007AFF] outline-none appearance-none"
            >
              <option value="" disabled>Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-[#E3E3E8] bg-[#F2F2F7]">
          <button 
            onClick={handleSave}
            className="w-full bg-[#007AFF] text-white font-semibold py-3.5 rounded-xl hover:bg-[#007AFF]/90 transition-colors active:scale-95"
          >
            {product ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
