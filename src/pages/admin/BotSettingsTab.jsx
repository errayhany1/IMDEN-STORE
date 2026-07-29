import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  Check,
  CloudCog,
  Database,
  Image,
  Loader2,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  fetchBotSettings,
  resetBotSettings,
  saveBotSettings,
} from '../../services/adminApi';

const GROUPS = [
  {
    id: 'workflow',
    label: 'سير العمل',
    subtitle: 'الموافقات والمزامنة',
    icon: Workflow,
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'destinations',
    label: 'وجهات النشر',
    subtitle: 'الاختيارات الافتراضية',
    icon: Send,
    color: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'ai',
    label: 'الذكاء الاصطناعي',
    subtitle: 'النماذج والمهل',
    icon: BrainCircuit,
    color: 'from-violet-400 to-fuchsia-500',
  },
  {
    id: 'images',
    label: 'معالجة الصور',
    subtitle: 'الجودة والأبعاد',
    icon: Image,
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: 'jumia',
    label: 'إعدادات Jumia',
    subtitle: 'القيم الافتراضية',
    icon: ShoppingBag,
    color: 'from-pink-400 to-rose-500',
  },
];

const CONNECTIONS = {
  telegram: { label: 'Telegram', icon: Send },
  nocodb: { label: 'NocoDB', icon: Database },
  productVariants: { label: 'ProductVariants', icon: SlidersHorizontal },
  openrouter: { label: 'OpenRouter', icon: Sparkles },
  openai: { label: 'OpenAI', icon: BrainCircuit },
  qwen: { label: 'Qwen', icon: Image },
  apify: { label: 'Amazon / Apify', icon: CloudCog },
  tifawt: { label: 'Tifawt', icon: Database },
  jumia: { label: 'Jumia', icon: ShoppingBag },
  sheet: { label: 'Google Sheet', icon: CloudCog },
};

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-all ${
        checked
          ? 'border-cyan-300/50 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,.28)]'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <span
        className={`absolute top-1 h-[18px] w-[18px] rounded-full bg-white shadow-md transition-all ${
          checked ? 'right-[25px]' : 'right-1'
        }`}
      />
    </button>
  );
}

function SettingControl({ settingKey, definition, value, onChange }) {
  if (definition.type === 'boolean') {
    return <Toggle checked={Boolean(value)} onChange={(next) => onChange(settingKey, next)} />;
  }

  return (
    <div className="w-full sm:w-60">
      <input
        type={definition.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        onChange={(event) => onChange(
          settingKey,
          definition.type === 'number' ? Number(event.target.value) : event.target.value,
        )}
        className="w-full rounded-xl border border-white/10 bg-[#07111f] px-3.5 py-2.5 text-left text-sm text-slate-100 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/10"
        dir={definition.type === 'text' ? 'ltr' : 'ltr'}
      />
      {definition.type === 'number' && (
        <div className="mt-1 flex justify-between text-[10px] text-slate-600">
          <span>{definition.min}</span>
          <span>{definition.max}</span>
        </div>
      )}
    </div>
  );
}

const BotSettingsTab = () => {
  const [payload, setPayload] = useState(null);
  const [draft, setDraft] = useState({});
  const [activeGroup, setActiveGroup] = useState('workflow');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchBotSettings();
      setPayload(result);
      setDraft(result.settings || {});
    } catch (error) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.error || 'تعذر تحميل إعدادات البوت',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changed = useMemo(() => {
    if (!payload) return false;
    return JSON.stringify(draft) !== JSON.stringify(payload.settings || {});
  }, [draft, payload]);

  const currentSettings = useMemo(
    () => Object.entries(payload?.schema || {}).filter(([, definition]) => definition.group === activeGroup),
    [payload, activeGroup],
  );

  const updateValue = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveBotSettings(draft);
      setPayload(result);
      setDraft(result.settings || {});
      setMessage({ type: 'success', text: 'تم حفظ الإعدادات وتفعيلها للعمليات الجديدة.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.error || 'فشل حفظ الإعدادات',
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('هل تريد إعادة جميع إعدادات البوت إلى القيم الافتراضية؟')) return;
    setSaving(true);
    try {
      const result = await resetBotSettings();
      setPayload(result);
      setDraft(result.settings || {});
      setMessage({ type: 'success', text: 'تمت استعادة القيم الافتراضية.' });
    } catch {
      setMessage({ type: 'error', text: 'تعذرت استعادة الإعدادات الافتراضية.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[560px] items-center justify-center rounded-[28px] bg-[#07111f] text-cyan-300">
        <Loader2 className="animate-spin" size={34} />
      </div>
    );
  }

  const activeMeta = GROUPS.find((group) => group.id === activeGroup) || GROUPS[0];
  const ActiveIcon = activeMeta.icon;
  const configuredCount = Object.values(payload?.connections || {}).filter(Boolean).length;
  const totalConnections = Object.keys(payload?.connections || {}).length;

  return (
    <section
      dir="rtl"
      className="relative min-h-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-[#07111f] text-slate-100 shadow-[0_24px_80px_rgba(2,8,23,.35)]"
    >
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative border-b border-white/10 px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-500 to-violet-600 shadow-[0_12px_34px_rgba(37,99,235,.3)]">
              <Bot size={28} className="text-white" />
              <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-[#07111f] bg-emerald-400" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold tracking-[.2em] text-cyan-300">
                  BOT CONTROL OS
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">مركز تحكم البوت</h2>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                إعدادات Telegram والذكاء والصور ووجهات النشر من مكان واحد
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10"
            >
              <RefreshCcw size={15} />
              تحديث
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-50"
            >
              <RefreshCcw size={15} />
              الافتراضي
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!changed || saving}
              className="flex min-w-32 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-cyan-400 to-blue-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>

      <div className="relative grid gap-5 p-4 sm:p-6 xl:grid-cols-[250px_minmax(0,1fr)_270px]">
        <aside className="space-y-2">
          <p className="mb-3 px-2 text-[10px] font-bold tracking-[.18em] text-slate-600">أقسام الإعدادات</p>
          {GROUPS.map((group) => {
            const Icon = group.icon;
            const active = group.id === activeGroup;
            const count = Object.values(payload?.schema || {}).filter((item) => item.group === group.id).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-right transition ${
                  active
                    ? 'border-cyan-300/20 bg-white/10 shadow-[inset_0_1px_rgba(255,255,255,.04)]'
                    : 'border-transparent text-slate-400 hover:border-white/5 hover:bg-white/[.035]'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${group.color} text-slate-950 shadow-lg`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-bold ${active ? 'text-white' : ''}`}>{group.label}</span>
                  <span className="block truncate text-[10px] text-slate-600">{group.subtitle}</span>
                </span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-500">{count}</span>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0">
          {message && (
            <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                : 'border-rose-400/20 bg-rose-400/10 text-rose-300'
            }`}>
              {message.type === 'success' ? <Check size={17} /> : <AlertTriangle size={17} />}
              {message.text}
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${activeMeta.color} text-slate-950`}>
              <ActiveIcon size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black">{activeMeta.label}</h3>
              <p className="text-xs text-slate-500">{activeMeta.subtitle}</p>
            </div>
          </div>

          <div className="space-y-3">
            {currentSettings.map(([key, definition]) => (
              <article
                key={key}
                className="flex flex-col gap-4 rounded-2xl border border-white/[.08] bg-white/[.035] p-4 transition hover:border-white/[.14] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-100">{definition.label}</h4>
                    {definition.restartRequired && (
                      <span className="rounded-md border border-amber-300/15 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                        يتطلب إعادة تشغيل
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{definition.description}</p>
                </div>
                <SettingControl
                  settingKey={key}
                  definition={definition}
                  value={draft[key]}
                  onChange={updateValue}
                />
              </article>
            ))}
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black">حالة الاتصالات</p>
                <p className="mt-1 text-[10px] text-slate-600">المفاتيح السرية مخفية وآمنة</p>
              </div>
              <ShieldCheck size={20} className="text-emerald-400" />
            </div>

            <div className="mb-4 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400"
                style={{ width: `${totalConnections ? (configuredCount / totalConnections) * 100 : 0}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(payload?.connections || {}).map(([key, connected]) => {
                const meta = CONNECTIONS[key] || { label: key, icon: CloudCog };
                const Icon = meta.icon;
                return (
                  <div key={key} className="rounded-xl border border-white/5 bg-[#07111f]/80 p-2.5">
                    <div className="mb-2 flex items-center justify-between">
                      <Icon size={14} className={connected ? 'text-emerald-400' : 'text-slate-600'} />
                      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-slate-700'}`} />
                    </div>
                    <p className="truncate text-[10px] font-bold text-slate-400">{meta.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[.04] p-4">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p className="text-xs font-bold text-amber-200">إعدادات البنية التحتية</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  توكنات Telegram وJumia وNocoDB لا تظهر هنا. يتم ضبطها في EasyPanel لحمايتها من المتصفح.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Database size={15} />
              حفظ الإعدادات
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-600">
              {payload?.storage?.persistentPathConfigured
                ? 'الإعدادات محفوظة في سجل تقني مخفي داخل NocoDB وتتم مزامنتها مع عملية Telegram تلقائياً.'
                : 'تعذر الوصول إلى NocoDB؛ لن يمكن حفظ إعدادات مشتركة بين خدمات البوت.'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default BotSettingsTab;
