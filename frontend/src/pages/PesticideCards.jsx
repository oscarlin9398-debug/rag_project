import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getPesticides, getCrops } from '../services/api';
import useIsMobile from '../hooks/useIsMobile';

const EARTH = {
  page: '#F5FAF7',
  surface: '#FFFFFF',
  border: '#CFE0D5',
  accent: '#0F4A34',
  accentLight: '#DCEAE2',
  accentText: '#E6F1EC',
  textDark: '#16241C',
  textMuted: '#3D4A43',
};

// 作物圖像與圖標對照表
const CROP_ICONS = {
  '水稻': { icon: '🌾', color: '#FEF3C7', border: '#F59E0B' },
  '稻': { icon: '🌾', color: '#FEF3C7', border: '#F59E0B' },
  '芒果': { icon: '🥭', color: '#FFEDD5', border: '#F97316' },
  '檬果': { icon: '🥭', color: '#FFEDD5', border: '#F97316' },
  '番茄': { icon: '🍅', color: '#FEE2E2', border: '#EF4444' },
  '甘藍': { icon: '🥬', color: '#DCFCE7', border: '#22C55E' },
  '高麗菜': { icon: '🥬', color: '#DCFCE7', border: '#22C55E' },
  '芭樂': { icon: '🍈', color: '#ECFCCB', border: '#84CC16' },
  '番石榴': { icon: '🍈', color: '#ECFCCB', border: '#84CC16' },
  '茶': { icon: '🍵', color: '#D1FAE5', border: '#10B981' },
  '蓮霧': { icon: '🍎', color: '#FFE4E6', border: '#F43F5E' },
  '香蕉': { icon: '🍌', color: '#FEF08A', border: '#EAB308' },
  '葡萄': { icon: '🍇', color: '#F3E8FF', border: '#A855F7' },
  '柑橘': { icon: '🍊', color: '#FFEDD5', border: '#FB923C' },
  '草莓': { icon: '🍓', color: '#FEE2E2', border: '#F43F5E' },
  '蔥': { icon: '🌱', color: '#E0F2FE', border: '#38BDF8' },
};

function getCropVisual(cropName = '') {
  for (const [k, v] of Object.entries(CROP_ICONS)) {
    if (cropName.includes(k)) return v;
  }
  return { icon: '🌿', color: '#E8F5E9', border: '#4CAF50' };
}

// 依法規標準之毒性危害標籤色帶 (紅/黃/藍/綠)
function getToxicityBadge(pesticideName = '', notes = '') {
  if (/加保扶|好年冬|納乃得|巴拉刈|大滅松/.test(pesticideName) || /劇毒/.test(notes)) {
    return { level: '劇毒 ☠️', bg: '#DC2626', color: '#FFFFFF', desc: '極度危險，嚴格列管' };
  }
  if (/中等毒/.test(notes) || /甲基多保淨/.test(pesticideName)) {
    return { level: '中等毒 ⚠️', bg: '#EAB308', color: '#000000', desc: '警告，注意施藥防護' };
  }
  if (/輕毒/.test(notes) || /殺蟲/.test(notes)) {
    return { level: '輕毒 ℹ️', bg: '#2563EB', color: '#FFFFFF', desc: '低度危險，小心使用' };
  }
  return { level: '普級 ✅', bg: '#16A34A', color: '#FFFFFF', desc: '安全普級，依標示施用' };
}

// 20 公升背負式噴藥桶劑量換算
function calc20LDosage(dilutionStr) {
  if (!dilutionStr) return null;
  const num = parseFloat(String(dilutionStr).replace(/,/g, ''));
  if (isNaN(num) || num <= 0) return null;
  const ml = Math.round((20000 / num) * 10) / 10;
  return {
    ratio: num,
    dosageText: `${ml} 毫升 (cc)`,
    explanation: `20公升水桶需加 ${ml} 毫升藥劑`,
  };
}

// 依「病蟲害名稱」推斷藥劑類型。
function inferType(pestName) {
  const n = pestName || '';
  if (!n) return '其他';
  // 蟎類（紅蜘蛛、葉蟎、銹蟎等）
  if (/(蟎|螨|紅蜘蛛|葉蟎|銹蟎|赤蟎|茶細蟎)/.test(n)) return '殺蟎';
  // 病害（各種病名、病原）
  if (/(病|菌|疫|露|銹|銹病|炭疽|白粉|灰黴|黴|萎凋|立枯|猝倒|軟腐|潰瘍|瘡痂|銹斑|葉斑|黑斑|褐斑|輪斑|角斑|腐爛|腐病|枯萎|線蟲|病毒|毒素病)/.test(n)) return '殺菌';
  // 雜草
  if (/(草|莎草|稗)/.test(n)) return '除草';
  // 其餘防治對象視為蟲害
  return '殺蟲';
}


export default function PesticideCards() {
  const [data, setData] = useState([]);
  const [crops, setCrops] = useState([]);
  const [crop, setCrop] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  // 作物搜尋（取代原本的下拉選單）
  const [cropQuery, setCropQuery] = useState('');
  const [cropOpen, setCropOpen] = useState(false);
  const cropBoxRef = useRef(null);

  useEffect(() => {
    getCrops().then(r => setCrops(r.data.作物清單 || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    // 只依作物向後端拿資料，type（殺蟲/殺菌…）改在前端用 inferType 篩選，
    // 這樣「篩選邏輯」和「卡片顯示的類型」用同一套判斷，不會出現篩選 0 筆的問題。
    getPesticides({ crop: crop || undefined, limit: 200 })
      .then(r => setData(r.data)).finally(() => setLoading(false));
  }, [crop]);

  // 點作物搜尋框以外的地方就收起清單
  useEffect(() => {
    if (!cropOpen) return;
    const onDoc = (e) => { if (cropBoxRef.current && !cropBoxRef.current.contains(e.target)) setCropOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [cropOpen]);

  // 依輸入關鍵字篩選作物清單（最多顯示 60 筆，避免清單過長）
  const filteredCrops = useMemo(() => {
    const q = cropQuery.trim();
    if (!q) return crops.slice(0, 60);
    return crops.filter(c => c.includes(q)).slice(0, 60);
  }, [crops, cropQuery]);

  const pickCrop = (c) => {
    setCrop(c);
    setCropQuery(c);
    setCropOpen(false);
  };
  const clearCrop = () => {
    setCrop('');
    setCropQuery('');
    setCropOpen(false);
  };

  const typeColors = { '殺菌': '#DCEAE2', '殺蟲': '#C6DDCF', '除草': '#AFCFBC', '殺蟎': '#D0E3D8', '其他': '#EAF3EE' };

  const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s);

  const FIELD_META = [
    { key: '作物名稱', label: '作物名稱' },
    { key: '病蟲害名稱', label: '防治對象' },
    { key: '登記分類名稱', label: '登記分類' },
    { key: '劑型', label: '劑型' },
    { key: '農藥含量', label: '農藥含量', hint: '有效成分濃度' },
    {
      key: '稀釋倍數', label: '稀釋倍數', unit: '倍',
      hint: (v) => {
        const n = parseFloat(v);
        if (!isNaN(n) && n > 1) {
          return `以此為例：農藥原液 1 毫升，加清水約 ${Math.round(n - 1)} 毫升，配成約 ${Math.round(n)} 毫升藥液使用`;
        }
        return '加水稀釋的比例，數字愈大代表加的水愈多、藥液愈淡';
      },
    },
    { key: '每公頃每次用量', label: '每公頃用量' },
    { key: '使用時期', label: '使用時期' },
    { key: '安全採收期_天', label: '安全採收期', hint: '最後一次施藥後，需等待幾天才能採收食用', unit: '天' },
    { key: '施藥間隔', label: '施藥間隔', hint: '兩次施藥之間至少要間隔幾天', unit: '天' },
    { key: '施用次數', label: '施用次數', hint: '整個生長季最多可施用幾次' },
    { key: '施用方法', label: '施用方法' },
    { key: '注意事項', label: '注意事項' },
  ];

  const selInput = { padding: '10px 16px', border: `1.5px solid ${EARTH.border}`, borderRadius: 8, background: EARTH.surface, color: EARTH.textDark, fontSize: 16, outline: 'none' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 24px', background: EARTH.page }}>
      <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: EARTH.accent, marginBottom: 9 }}>農藥百科卡</h1>
      <p style={{ color: EARTH.textMuted, marginBottom: isMobile ? 22 : 29, fontSize: isMobile ? 14 : 17 }}>查詢各作物可用農藥登記資料，含使用注意事項</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 作物：可打字搜尋 */}
        <div ref={cropBoxRef} style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 0 260px' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={cropQuery}
              onChange={e => { setCropQuery(e.target.value); setCropOpen(true); }}
              onFocus={() => setCropOpen(true)}
              placeholder="輸入或選擇作物（例如：芒果）"
              style={{ ...selInput, width: '100%', boxSizing: 'border-box', paddingRight: 34 }}
            />
            {cropQuery && (
              <span onClick={clearCrop} title="清除"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: EARTH.textMuted, fontSize: 16 }}>
                ✕
              </span>
            )}
          </div>
          {cropOpen && (
            <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 30, background: EARTH.surface, border: `1px solid ${EARTH.border}`, borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto' }}>
              <div onClick={clearCrop}
                style={{ padding: '10px 14px', fontSize: 15, cursor: 'pointer', color: EARTH.accent, borderBottom: `1px solid ${EARTH.accentLight}`, fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.background = EARTH.accentLight}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                全部作物
              </div>
              {filteredCrops.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 14, color: EARTH.textMuted }}>找不到「{cropQuery}」</div>
              ) : filteredCrops.map(c => (
                <div key={c} onClick={() => pickCrop(c)}
                  style={{ padding: '10px 14px', fontSize: 15, cursor: 'pointer', color: EARTH.textDark, background: c === crop ? EARTH.accentLight : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = EARTH.accentLight}
                  onMouseLeave={e => e.currentTarget.style.background = c === crop ? EARTH.accentLight : 'transparent'}>
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 類型：維持下拉（只有五個選項，不需搜尋）*/}
        <select value={type} onChange={e => setType(e.target.value)} style={{ ...selInput, flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
          <option value="">全部類型</option>
          {['殺菌', '殺蟲', '除草', '殺蟎'].map(t => <option key={t} value={t}>{t}劑</option>)}
        </select>

        <span style={{ color: EARTH.textMuted, fontSize: 15, alignSelf: 'center' }}>共 {data.filter(p => !type || inferType(p.病蟲害名稱) === type).length} 筆</span>
      </div>

      {loading ? <p style={{ color: EARTH.textMuted }}>載入中...</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {data.filter(p => !type || inferType(p.病蟲害名稱) === type).map(p => {
            const t = inferType(p.病蟲害名稱);
            const cropVis = getCropVisual(p.作物名稱);
            const tox = getToxicityBadge(p.農藥中文普通名稱, p.注意事項);
            const d20 = calc20LDosage(p.稀釋倍數);
            return (
              <div key={p.id} onClick={() => setSelected(p)}
                style={{
                  background: EARTH.surface,
                  border: `1.5px solid ${cropVis.border || EARTH.border}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,74,52,0.14)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}>
                
                {/* 危害毒性等級色帶 (依法規標準分級標示) */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: tox.bg }} />

                <div>
                  {/* 標籤列：作物圖標 + 毒性等級 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cropVis.color, color: '#1B4332', fontSize: 13, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: `1px solid ${cropVis.border}` }}>
                      <span>{cropVis.icon}</span> {p.作物名稱}
                    </span>
                    <span style={{ fontSize: 12, background: tox.bg, color: tox.color, padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      {tox.level}
                    </span>
                  </div>

                  {/* 農藥瓶裝圖示與藥名 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, border: '1px solid #E5E7EB' }}>
                      🧪
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: 18, color: EARTH.textDark, margin: '0 0 2px' }}>{p.農藥中文普通名稱}</h3>
                      <span style={{ fontSize: 13, color: EARTH.accent, fontWeight: 500 }}>{t}劑 · {p.劑型 || '標準劑型'}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: 14, color: EARTH.textMuted, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    🎯 防治對象：<strong style={{ color: EARTH.textDark }}>{p.病蟲害名稱}</strong>
                  </p>

                  {/* 視覺特色標籤：20L 噴藥桶換算 + 安全採收期時鐘 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: p.注意事項 ? 8 : 0 }}>
                    {d20 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '4px 8px', borderRadius: 6 }}>
                        <span>🎒</span>
                        <span><strong>20L 噴藥桶：</strong>加水配 <strong>{d20.dosageText}</strong></span>
                      </div>
                    )}
                    {p.安全採收期_天 && p.安全採收期_天 !== '-' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', padding: '4px 8px', borderRadius: 6 }}>
                        <span>⏱️</span>
                        <span>安全採收期間隔：<strong>{p.安全採收期_天} 天</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {p.注意事項 && (
                  <p style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px dashed #FCD34D', borderRadius: 6, padding: '5px 8px', margin: '8px 0 0', lineHeight: 1.4 }}>
                    ⚠️ {truncate(p.注意事項, 32)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && data.filter(p => !type || inferType(p.病蟲害名稱) === type).length === 0 && (
        <p style={{ color: EARTH.textMuted, marginTop: 8 }}>沒有符合條件的資料，換個作物或類型試試。</p>
      )}

      {selected && (() => {
        const cropVis = getCropVisual(selected.作物名稱);
        const tox = getToxicityBadge(selected.農藥中文普通名稱, selected.注意事項);
        const d20 = calc20LDosage(selected.稀釋倍數);
        return (
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(43,38,32,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: isMobile ? 14 : 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: EARTH.surface, borderRadius: 18, padding: isMobile ? '20px 16px' : '32px', maxWidth: 640, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
              
              {/* 頂部彩色毒性標籤列 */}
              <div style={{ background: tox.bg, color: tox.color, borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, fontWeight: 600, fontSize: 14 }}>
                <span>標籤毒性分級：{tox.level}</span>
                <span>{tox.desc}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: cropVis.color, color: '#1B4332', fontSize: 14, fontWeight: 600, padding: '3px 10px', borderRadius: 6, marginBottom: 8, border: `1px solid ${cropVis.border}` }}>
                    <span>{cropVis.icon}</span> 適用作物：{selected.作物名稱}
                  </div>
                  <h2 style={{ fontWeight: 800, color: EARTH.accent, fontSize: isMobile ? 24 : 28, margin: 0 }}>{selected.農藥中文普通名稱}</h2>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: '#F3F4F6', border: 'none', width: 36, height: 36, borderRadius: 18, fontSize: 18, color: EARTH.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* 田間施藥調配速查圖卡 */}
              <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🎒 田間施藥速查指南 (20公升噴藥桶)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, fontSize: 14 }}>
                  <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: 8, border: '1px solid #DCFCE7' }}>
                    <div style={{ color: '#4B5563', fontSize: 12 }}>背負式噴藥桶加藥量</div>
                    <div style={{ color: '#15803D', fontWeight: 700, fontSize: 16, marginTop: 2 }}>
                      {d20 ? d20.dosageText : '依標籤倍數計算'}
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: 8, border: '1px solid #DCFCE7' }}>
                    <div style={{ color: '#4B5563', fontSize: 12 }}>安全採收期 (PHI)</div>
                    <div style={{ color: '#B45309', fontWeight: 700, fontSize: 16, marginTop: 2 }}>
                      {selected.安全採收期_天 && selected.安全採收期_天 !== '-' ? `施藥後 ${selected.安全採收期_天} 天` : '未特別限制'}
                    </div>
                  </div>
                </div>

                {/* 防護裝備圖標列 */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #BBF7D0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, color: '#166534' }}>
                  <span style={{ fontWeight: 600 }}>必備防護：</span>
                  <span>😷 防護口罩</span>
                  <span>🥽 護目鏡</span>
                  <span>🧤 橡膠手套</span>
                  <span>👕 長袖長褲</span>
                </div>
              </div>

              {/* 官方登記資料詳細列表 */}
              <div style={{ borderTop: `1px solid ${EARTH.border}`, paddingTop: 12 }}>
                {FIELD_META.map(({ key, label, hint, unit }) => {
                  const value = selected[key];
                  if (!value || value === '-') return null;
                  const displayValue = unit && !String(value).includes(unit) ? `${value} ${unit}` : value;
                  const hintText = typeof hint === 'function' ? hint(value) : hint;
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 4 : 17, padding: '10px 0', borderBottom: `1px solid ${EARTH.accentLight}` }}>
                      <span style={{ color: EARTH.textMuted, fontSize: 15, minWidth: isMobile ? 'auto' : 125, fontWeight: 500 }}>
                        {label}
                        {hintText && <div style={{ fontSize: 12, color: EARTH.textMuted, opacity: 0.85, marginTop: 2 }}>（{hintText}）</div>}
                      </span>
                      <span style={{ color: EARTH.textDark, fontSize: 15, flex: 1, lineHeight: 1.6 }}>{displayValue}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 18, fontSize: 13, color: EARTH.textMuted, textAlign: 'right' }}>
                資料來源：農業部動植物防疫檢疫署 2026 官方核准登記
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}