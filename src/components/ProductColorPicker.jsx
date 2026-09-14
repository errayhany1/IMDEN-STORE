import React from 'react';

export default function ProductColorPicker({
  variants = [],
  selectedId,
  onSelect,
  allowAll = false,
  isFr = false,
  dm = false,
}) {
  if (!variants.length) return null;
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const line = dm ? 'border-white/10' : 'border-slate-200';

  return (
    <div className="mt-4">
      <p className={`text-xs font-semibold mb-2 ${muted}`}>
        {isFr ? 'Choisir la couleur' : 'اختر اللون'}
      </p>
      <div className="flex flex-wrap gap-2">
        {allowAll && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
              selectedId == null
                ? 'border-primary text-primary bg-primary/10'
                : `${line} ${muted}`
            }`}
          >
            {isFr ? 'Toutes les couleurs' : 'كل الألوان'}
          </button>
        )}
        {variants.map((variant) => {
          const selected = String(selectedId) === String(variant.id);
          const out = variant.inStock === false;
          return (
            <button
              key={variant.id || variant.sku}
              type="button"
              onClick={() => onSelect(variant.id)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                selected
                  ? 'border-primary text-primary bg-primary/10'
                  : `${line} ${muted}`
              } ${out ? 'opacity-50 line-through' : ''}`}
            >
              {isFr ? variant.colorFr : variant.colorAr}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function cartProductFromVariant(product, variant, isFr = false) {
  if (!product) return product;
  if (!variant) return product;
  const color = isFr ? variant.colorFr : variant.colorAr;
  return {
    ...product,
    id: `${product.id}-color-${variant.code || variant.sku || variant.id}`,
    ref: variant.sku || product.ref,
    name: color ? `${product.name} — ${color}` : product.name,
    image: variant.images?.[0] || product.image,
    images: variant.images?.length ? variant.images : product.images,
    selectedColor: color,
    colorCode: variant.code,
  };
}
