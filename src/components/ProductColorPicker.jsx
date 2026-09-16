import React from 'react';

const FALLBACK_HEX = {
  Noir: '#1a1a1a', Blanc: '#f8fafc', Bleu: '#2563eb', Rouge: '#dc2626',
  Rose: '#ec4899', Vert: '#16a34a', Violet: '#7c3aed', Jaune: '#eab308',
  Orange: '#ea580c', Gris: '#64748b', Marron: '#92400e', 'Doré': '#d4a017',
  'Argenté': '#94a3b8', Beige: '#d6c4a8', Ciel: '#38bdf8', Mauve: '#c084fc',
  أسود: '#1a1a1a', أبيض: '#f8fafc', أزرق: '#2563eb', أحمر: '#dc2626',
  وردي: '#ec4899', أخضر: '#16a34a', بنفسجي: '#7c3aed', أصفر: '#eab308',
  برتقالي: '#ea580c', رمادي: '#64748b', بني: '#92400e', ذهبي: '#d4a017',
  فضي: '#94a3b8', بيج: '#d6c4a8', سماوي: '#38bdf8', موف: '#c084fc',
};

export function swatchStyle(variant) {
  const hexes = Array.isArray(variant?.hexes) && variant.hexes.length
    ? variant.hexes
    : String(variant?.colorFr || variant?.colorAr || '')
      .split(/\s+(?:et|و)\s+/i)
      .map((part) => FALLBACK_HEX[part.trim()])
      .filter(Boolean);
  if (hexes.length >= 2) {
    return { background: `linear-gradient(135deg, ${hexes[0]} 50%, ${hexes[1]} 50%)` };
  }
  return { backgroundColor: hexes[0] || '#94a3b8' };
}

function SwatchDot({ variant, size = 'w-4 h-4' }) {
  const hexes = variant?.hexes || [];
  const light = hexes[0] === '#f8fafc' || hexes[0] === '#d6c4a8';
  return (
    <span
      className={`${size} rounded-full border shrink-0 ${light ? 'border-slate-300' : 'border-black/20'}`}
      style={swatchStyle(variant)}
      aria-hidden="true"
    />
  );
}

export default function ProductColorPicker({
  variants = [],
  selectedId,
  onSelect,
  allowAll = false,
  isFr = false,
  dm = false,
  appearance = 'pills',
}) {
  if (!variants.length) return null;
  const muted = dm ? 'text-gray-400' : 'text-slate-500';
  const line = dm ? 'border-white/10' : 'border-slate-200';
  const label = isFr ? 'Choisir la couleur' : 'اختر اللون';

  if (appearance === 'swatches') {
    return (
      <div>
        <p className={`text-sm font-semibold mb-2.5 ${dm ? 'text-gray-200' : 'text-slate-700'}`}>
          {label} :
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {allowAll && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`h-10 px-3 rounded-full border text-xs font-semibold transition ${
                selectedId == null
                  ? 'border-primary text-primary bg-white ring-2 ring-primary/20'
                  : `${line} ${muted}`
              }`}
            >
              {isFr ? 'Toutes' : 'الكل'}
            </button>
          )}
          {variants.map((variant) => {
            const selected = String(selectedId) === String(variant.id);
            const out = variant.inStock === false;
            const name = isFr ? variant.colorFr : variant.colorAr;
            return (
              <button
                key={variant.id || variant.sku}
                type="button"
                onClick={() => onSelect(variant.id)}
                title={name}
                className={`inline-flex items-center gap-2 rounded-full border transition-all ${
                  selected
                    ? 'h-10 pe-3 ps-1.5 border-primary bg-white text-slate-800 shadow-sm ring-2 ring-primary/15'
                    : 'h-10 w-10 justify-center border-slate-200 bg-white hover:border-slate-300'
                } ${out ? 'opacity-45' : ''} ${dm && selected ? 'bg-gray-800 text-white border-primary' : ''} ${
                  dm && !selected ? 'bg-gray-800 border-gray-600' : ''
                }`}
              >
                <SwatchDot variant={variant} size="w-7 h-7" />
                {selected && (
                  <span className="text-sm font-medium pe-0.5">{name}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className={`text-xs font-semibold mb-2 ${muted}`}>
        {label}
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
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                selected
                  ? 'border-primary text-primary bg-primary/10'
                  : `${line} ${muted}`
              } ${out ? 'opacity-50 line-through' : ''}`}
            >
              <SwatchDot variant={variant} />
              {isFr ? variant.colorFr : variant.colorAr}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProductColorDots({ variants = [], max = 6 }) {
  if (!variants?.length) return null;
  const extra = variants.length - max;
  return (
    <div className="flex items-center gap-1 justify-end">
      {variants.slice(0, max).map((variant) => (
        <SwatchDot
          key={variant.sku || variant.id}
          variant={variant}
          size="w-3.5 h-3.5"
        />
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-slate-400 font-bold">+{extra}</span>
      )}
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
