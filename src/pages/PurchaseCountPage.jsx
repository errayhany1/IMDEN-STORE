import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  FileText,
  ImagePlus,
  PackagePlus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import jsPDF from 'jspdf';

const STORAGE_KEY = 'errayhany_purchase_count_draft_v1';
const A4 = { width: 1240, height: 1754 };
const ROWS_PER_PAGE = 6;

function newItem() {
  return {
    id: globalThis.crypto?.randomUUID?.()
      || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    quantity: 1,
    image: '',
  };
}

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      title: saved.title || 'لائحة السلع المشتراة',
      worker: saved.worker || '',
      note: saved.note || '',
      items: Array.isArray(saved.items) && saved.items.length ? saved.items : [newItem()],
    };
  } catch {
    return {
      title: 'لائحة السلع المشتراة',
      worker: '',
      note: '',
      items: [newItem()],
    };
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function compressImage(file) {
  const source = await readFile(file);
  const image = await loadImage(source);
  if (!image) return source;
  const max = 900;
  const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawContainedImage(context, image, x, y, width, height) {
  context.fillStyle = '#f3f6f8';
  roundedRect(context, x, y, width, height, 18);
  context.fill();
  if (!image) return;
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.save();
  roundedRect(context, x, y, width, height, 18);
  context.clip();
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((value, index) => context.fillText(value, x, y + (index * lineHeight)));
}

async function buildPdf({ title, worker, note, items }) {
  const validItems = items.filter((item) => item.name.trim() && Number(item.quantity) > 0);
  const pages = [];
  for (let start = 0; start < validItems.length; start += ROWS_PER_PAGE) {
    const pageItems = validItems.slice(start, start + ROWS_PER_PAGE);
    const canvas = document.createElement('canvas');
    canvas.width = A4.width;
    canvas.height = A4.height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f6f8fb';
    context.fillRect(0, 0, A4.width, A4.height);

    context.fillStyle = '#0f766e';
    context.fillRect(0, 0, A4.width, 150);
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#fff';
    context.font = '700 42px Arial, sans-serif';
    context.fillText(title || 'لائحة السلع المشتراة', 1170, 65);
    context.font = '24px Arial, sans-serif';
    const date = new Intl.DateTimeFormat('ar-MA', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date());
    context.fillText(`${worker ? `المكلّف: ${worker}  •  ` : ''}${date}`, 1170, 112);

    let y = 185;
    const loadedImages = await Promise.all(pageItems.map((item) => loadImage(item.image)));
    pageItems.forEach((item, index) => {
      const rowHeight = 220;
      context.fillStyle = '#fff';
      context.strokeStyle = '#dbe4ea';
      context.lineWidth = 2;
      roundedRect(context, 55, y, 1130, rowHeight, 24);
      context.fill();
      context.stroke();

      drawContainedImage(context, loadedImages[index], 80, y + 20, 260, 180);

      context.direction = 'rtl';
      context.textAlign = 'right';
      context.fillStyle = '#13232f';
      context.font = '700 31px Arial, sans-serif';
      drawWrappedText(context, item.name, 1135, y + 62, 690, 42, 3);

      context.fillStyle = '#0f766e';
      context.font = '700 30px Arial, sans-serif';
      context.fillText(`الكمية: ${Number(item.quantity)}`, 1135, y + 174);

      context.fillStyle = '#647481';
      context.font = '22px Arial, sans-serif';
      context.textAlign = 'left';
      context.direction = 'ltr';
      context.fillText(`#${start + index + 1}`, 370, y + 175);
      y += rowHeight + 22;
    });

    if (note && start + ROWS_PER_PAGE >= validItems.length) {
      context.direction = 'rtl';
      context.textAlign = 'right';
      context.fillStyle = '#425466';
      context.font = '24px Arial, sans-serif';
      drawWrappedText(context, `ملاحظة: ${note}`, 1160, 1660, 1080, 32, 2);
    }
    context.direction = 'ltr';
    context.textAlign = 'center';
    context.fillStyle = '#82919d';
    context.font = '19px Arial, sans-serif';
    context.fillText(`Errayhany • ${start / ROWS_PER_PAGE + 1}`, A4.width / 2, 1725);
    pages.push(canvas.toDataURL('image/jpeg', 0.9));
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(page, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });
  pdf.save(`لائحة-السلع-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function PurchaseCountPage() {
  const initial = useRef(loadDraft());
  const [title, setTitle] = useState(initial.current.title);
  const [worker, setWorker] = useState(initial.current.worker);
  const [note, setNote] = useState(initial.current.note);
  const [items, setItems] = useState(initial.current.items);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  const validCount = useMemo(
    () => items.filter((item) => item.name.trim() && Number(item.quantity) > 0).length,
    [items],
  );
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items],
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        title,
        worker,
        note,
        items,
      }));
    } catch {
      setMessage('تعذر حفظ المسودة لأن الصور كبيرة جداً، لكن يمكنك إنشاء PDF الآن.');
    }
  }, [items, note, title, worker]);

  const patchItem = (id, patch) => {
    setItems((current) => current.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  };

  const handleImage = async (id, file) => {
    if (!file) return;
    setMessage('جاري تجهيز الصورة...');
    try {
      const image = await compressImage(file);
      patchItem(id, { image });
      setMessage('تمت إضافة الصورة.');
    } catch {
      setMessage('تعذر قراءة الصورة. جرّب صورة أخرى.');
    }
  };

  const reset = () => {
    if (!window.confirm('هل تريد حذف جميع السلع وبدء لائحة جديدة؟')) return;
    setTitle('لائحة السلع المشتراة');
    setWorker('');
    setNote('');
    setItems([newItem()]);
    localStorage.removeItem(STORAGE_KEY);
    setMessage('تم إنشاء لائحة جديدة.');
  };

  const generate = async () => {
    if (!validCount) {
      setMessage('أضف اسم منتج وكمية صحيحة أولاً.');
      return;
    }
    setGenerating(true);
    setMessage('جاري إنشاء ملف PDF...');
    try {
      await buildPdf({ title, worker, note, items });
      setMessage('تم تنزيل ملف PDF بنجاح.');
    } catch (error) {
      console.error('Purchase PDF failed:', error);
      setMessage('تعذر إنشاء PDF. جرّب تقليل عدد الصور أو حجمها.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#eef3f4] text-slate-900">
      <header className="bg-gradient-to-l from-teal-800 via-teal-700 to-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-7 md:py-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
              <FileText size={26} />
            </div>
            <div>
              <p className="text-xs text-teal-100 font-bold tracking-wide">ERRAYHANY • أداة داخلية</p>
              <h1 className="text-2xl md:text-3xl font-black mt-1">حساب السلع بالصور</h1>
            </div>
          </div>
          <p className="text-sm text-teal-50/90 mt-4 max-w-2xl leading-7">
            صوّر السلعة، اكتب اسمها والكمية، ثم نزّل لائحة PDF واضحة تساعد على التعرف على المنتجات.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 md:px-5 py-5 pb-36">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-black text-slate-500">عنوان اللائحة</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="مثال: مشتريات اليوم"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black text-slate-500">اسم المكلّف (اختياري)</span>
              <input
                value={worker}
                onChange={(event) => setWorker(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="اسم الشخص"
              />
            </label>
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-lg">السلع</h2>
            <p className="text-xs text-slate-500 mt-1">{validCount} منتج • مجموع الكمية {totalQuantity}</p>
          </div>
          <button
            type="button"
            onClick={() => setItems((current) => [...current, newItem()])}
            className="rounded-2xl bg-teal-700 hover:bg-teal-800 text-white px-4 py-3 font-black text-sm flex items-center gap-2 shadow-lg shadow-teal-700/20"
          >
            <PackagePlus size={19} />
            إضافة سلعة
          </button>
        </div>

        <section className="mt-3 space-y-4">
          {items.map((item, index) => (
            <article key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-black text-slate-600">السلعة {index + 1}</span>
                <button
                  type="button"
                  onClick={() => setItems((current) => (
                    current.length === 1
                      ? [{ ...current[0], name: '', quantity: 1, image: '' }]
                      : current.filter((entry) => entry.id !== item.id)
                  ))}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50"
                  aria-label="حذف السلعة"
                >
                  <Trash2 size={19} />
                </button>
              </div>

              <div className="p-4 grid md:grid-cols-[220px_1fr] gap-4">
                <label className="relative min-h-48 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden cursor-pointer hover:border-teal-400 transition-colors">
                  {item.image ? (
                    <img src={item.image} alt={item.name || 'صورة المنتج'} className="absolute inset-0 w-full h-full object-contain bg-white" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <ImagePlus size={36} />
                      <span className="font-black text-sm mt-3">أضف صورة</span>
                      <span className="text-xs mt-1">الكاميرا أو المعرض</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleImage(item.id, event.target.files?.[0])}
                  />
                  {item.image && (
                    <span className="absolute bottom-2 right-2 bg-slate-900/75 text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
                      <Camera size={14} />
                      تغيير
                    </span>
                  )}
                </label>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-black text-slate-500">اسم المنتج</span>
                    <input
                      value={item.name}
                      onChange={(event) => patchItem(item.id, { name: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                      placeholder="مثال: شاحن هاتف سريع"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black text-slate-500">الكمية</span>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => patchItem(item.id, { quantity: Math.max(1, Number(item.quantity) - 1) })}
                        className="w-12 h-12 rounded-2xl border border-slate-200 text-xl font-black hover:bg-slate-50"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => patchItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                        className="w-24 h-12 rounded-2xl border border-slate-200 text-center text-lg font-black outline-none focus:border-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => patchItem(item.id, { quantity: Number(item.quantity) + 1 })}
                        className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-100 text-xl font-black hover:bg-teal-100"
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <label className="block">
            <span className="text-xs font-black text-slate-500">ملاحظة عامة (اختيارية)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full min-h-24 rounded-2xl border border-slate-200 px-4 py-3 outline-none resize-y focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              placeholder="أي تفاصيل إضافية عن المشتريات..."
            />
          </label>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl bg-teal-50 border border-teal-100 text-teal-900 px-4 py-3 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="max-w-5xl mx-auto px-3 md:px-5 py-3 flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex-1 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white py-3.5 font-black flex items-center justify-center gap-2"
          >
            <Download size={20} />
            {generating ? 'جاري إنشاء PDF...' : 'تنزيل PDF'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-slate-200 bg-white px-4 text-slate-600 hover:bg-slate-50"
            aria-label="لائحة جديدة"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
