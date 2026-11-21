// Engineering Simulation Center: discipline (field) row + simulation tabs, simulations loaded on demand from modules.
// Module contract: export const SIMS = [{ id, field, title, icon, desc, mount(host, ctx) -> cleanup }]; ctx.clean.add(fn).
import { esc } from './ui.js';

export const FIELDS = [
  { id: 'eee', title: 'Elektrik-Elektronik' },
  { id: 'kontrol', title: 'Kontrol & Sinyal' },
  { id: 'makine', title: 'Makine & Dinamik' },
  { id: 'termo', title: 'Termo & Akışkan' },
  { id: 'havacilik', title: 'Havacılık & Uzay' },
  { id: 'insaat', title: 'İnşaat & Yapı' },
  { id: 'malzeme', title: 'Malzeme' },
  { id: 'kimya', title: 'Kimya Müh.' },
  { id: 'bilgisayar', title: 'Bilgisayar' },
  { id: 'endustri', title: 'Endüstri & Yöneylem' },
  { id: 'biyomed', title: 'Biyomedikal' },
  { id: 'fizikmat', title: 'Fizik & Matematik' },
  { id: 'simetri', title: 'Simetri & Grup Teorisi' },
];

const MODULES = ['./simlab-eee.js', './simlab-mech.js', './simlab-civil.js', './simlab-comp.js'];

// Group Theory Center tabs that are simulations rather than tables/lessons; they keep living there too.
const GROUP_SIMS = ['simetri', 'permutasyon', 'graf', 'su2-lab', 'su3-lab', 'kok-sistemi', 'weyl-grubu', 'harmonik-su3', 'bohr-so4', 'hilbert-fermi', 'lorentz-poincare', 'konformal-grup', 'aile-simetrileri', 'simetri-galerisi'];

const tryImport = async path => { try { return (await import(path)).SIMS || []; } catch (err) { console.warn('Simülasyon modülü yüklenemedi', path, err); return []; } };

export async function allSims() {
  const [{ SIMS: EEE, mountSim }, groupMod, ...mods] = await Promise.all([
    import('./sim.js'), import('./groupcenter.js').catch(() => null), ...MODULES.map(tryImport),
  ]);
  const sims = EEE.map(s => ({ ...s, field: 'eee', mount: host => mountSim(host, s.id) }));
  for (const list of mods) sims.push(...list);
  if (groupMod) {
    const tabs = await groupMod.allTabs();
    for (const id of GROUP_SIMS) {
      const t = tabs.find(x => x.id === id);
      if (t) sims.push({ id: 'g-' + id, field: 'simetri', title: t.title, icon: t.icon, mount: host => groupMod.mountGroupCenter(host, id, tabs) });
    }
  }
  const order = new Map(FIELDS.map((f, i) => [f.id, i]));
  return sims.filter(s => order.has(s.field)).sort((a, b) => order.get(a.field) - order.get(b.field));
}

export function mountSimCenter(host, sim) {
  const fns = [];
  const ctx = { clean: { add: fn => typeof fn === 'function' && fns.push(fn) } };
  try { ctx.clean.add(sim.mount(host, ctx)); }
  catch (err) { console.error(err); host.innerHTML = `<p class="mute">Bu simülasyon açılamadı: ${esc(err.message || String(err))}</p>`; }
  return () => { while (fns.length) { try { fns.pop()(); } catch { } } };
}
