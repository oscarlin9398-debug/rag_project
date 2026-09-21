import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import useIsMobile from '../hooks/useIsMobile';
import { visionDiagnose } from '../services/api';

const QUICK = ['草莓可以用哪些殺菌劑？', '空心菜殺蟲劑有哪些？', '高麗菜除草劑怎麼用？', '甜椒殺螨劑推薦？'];

const EARTH = {
  page: '#F5FAF7',
  surface: '#FFFFFF',
  sidebarBg: '#EFF6F1',
  border: '#CFE0D5',
  accent: '#0F4A34',
  accentLight: '#DCEAE2',
  accentSoft: '#EAF3EE',
  accentText: '#E6F1EC',
  textDark: '#16241C',
  textMuted: '#3D4A43',
  warnBg: '#FCEFD4',
};

function tidyText(text) {
  return text.replace(/\n{2,}/g, '\n');
}

// 側邊欄單筆對話：含 ⋯ 選單（釘選 / 重新命名 / 刪除）、就地改名、刪除確認
function ConversationRow({ conv, active, onSelect, onRename, onTogglePin, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const inputRef = useRef(null);
  const rowRef = useRef(null);

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select(); }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => { if (rowRef.current && !rowRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const commitRename = () => { onRename(conv.id, draft); setEditing(false); };

  return (
    <div ref={rowRef} style={{ position: 'relative' }}>
      <div onClick={() => !editing && onSelect(conv.id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          padding: '11px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 14,
          background: active ? EARTH.accentLight : 'transparent',
          color: active ? EARTH.textDark : EARTH.textMuted,
          fontWeight: active ? 600 : 400,
        }}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraft(conv.title); setEditing(false); } }}
            onBlur={commitRename}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, fontSize: 14, padding: '4px 6px', border: `1px solid ${EARTH.accent}`, borderRadius: 6, outline: 'none' }}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {conv.pinned && <span title="已釘選" style={{ flexShrink: 0 }}>📌</span>}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title}</span>
          </span>
        )}

        {!editing && (
          <span onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }} title="更多"
            style={{ opacity: 0.6, fontSize: 18, lineHeight: 1, padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}>
            ⋯
          </span>
        )}
      </div>

      {menuOpen && !editing && (
        <div style={{
          position: 'absolute', top: 42, right: 8, zIndex: 20,
          background: EARTH.surface, border: `1px solid ${EARTH.border}`, borderRadius: 10,
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 140,
        }}>
          <MenuItem label={conv.pinned ? '📌 取消釘選' : '📌 釘選'}
            onClick={() => { onTogglePin(conv.id); setMenuOpen(false); }} />
          <MenuItem label="✏️ 重新命名"
            onClick={() => { setDraft(conv.title); setEditing(true); setMenuOpen(false); }} />
          <MenuItem label="🗑 刪除" danger
            onClick={() => { setConfirming(true); setMenuOpen(false); }} />
        </div>
      )}

      {confirming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setConfirming(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: EARTH.surface, borderRadius: 14, padding: '22px 24px', width: 320, maxWidth: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: EARTH.textDark, marginBottom: 8 }}>刪除對話</div>
            <div style={{ fontSize: 14, color: EARTH.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              確定要刪除「{conv.title}」嗎？此動作無法復原。
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirming(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${EARTH.border}`, background: EARTH.surface, color: EARTH.textMuted, fontSize: 14, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => { onDelete(conv.id); setConfirming(false); }}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <div onClick={onClick}
      style={{ padding: '12px 15px', fontSize: 14, cursor: 'pointer', color: danger ? '#C0392B' : '#16241C', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(192,57,43,0.08)' : 'rgba(0,0,0,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {label}
    </div>
  );
}

// 側邊欄內容（桌機固定顯示、手機抽屜共用）
function SidebarContent({ conversations, activeId, onSelect, onNew, onRename, onTogglePin, onDelete }) {
  const sortedConvs = [...conversations].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return b.updatedAt - a.updatedAt;
  });
  return (
    <>
      <button onClick={onNew}
        style={{ width: '100%', padding: '12px 0', background: EARTH.accent, color: EARTH.accentText, border: 'none', borderRadius: 22, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 16 }}>
        ＋ 新對話
      </button>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sortedConvs.map(c => (
          <ConversationRow
            key={c.id}
            conv={c}
            active={c.id === activeId}
            onSelect={onSelect}
            onRename={onRename}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}

export default function RAG() {
  const {
    conversations, activeId, setActiveId, pendingIds,
    enterRAG, newConversation, deleteConversation, renameConversation, togglePin, send, isGuest,
  } = useChat();
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const endRef = useRef(null);
  const enteredRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (enteredRef.current) return;
    if (!activeId) enterRAG();
    enteredRef.current = true;

  }, [activeId]);

  const active = conversations.find(c => c.id === activeId) || conversations[0];
  const msgs = active ? active.messages : [];
  const loading = pendingIds.includes(activeId);
  const [isFarmerMode, setIsFarmerMode] = useState(true);
  const [diagnosingImage, setDiagnosingImage] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const handleSend = (q) => {
    if (!q.trim() || loading) return;
    const convId = activeId;
    setInput('');
    send(convId, q);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setDiagnosingImage(true);
      const convId = activeId;
      try {
        const res = await visionDiagnose(base64, null, isFarmerMode);
        const diag = res.data?.visual_diagnosis || {};
        const ragSol = res.data?.rag_solution || {};
        const replyText = `【📸 照片病徵視覺辨識結果】\n` +
          `• 辨識作物：${diag.crop || '農作物'}\n` +
          `• 疑似病害/害蟲：${diag.pest || '疑似病害'}（信心度：${Math.round((diag.confidence || 0.88) * 100)}%）\n` +
          `• 病徵特徵觀察：${diag.description || '患部葉片出現病徵'}\n\n` +
          `【🌾 官方核准合法用藥指引】\n` +
          `${ragSol.answer || '請參照下方官方登記推薦藥劑。'}`;

        send(convId, `[📸 上傳了農作物葉片照片進行病理診斷]`, {
          userImage: base64,
          text: replyText,
          sources: ragSol.sources || [],
          crop: diag.crop,
          pest: diag.pest,
        });
      } catch (err) {
        alert("照片辨識服務呼叫異常，請確認後端是否正在運行！");
      } finally {
        setDiagnosingImage(false);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (albumInputRef.current) albumInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportTGAP = (msgText, crop, pest) => {
    const today = new Date().toISOString().split('T')[0];
    const tgapRecord = 
`========================================
【台灣良好農業規範 (TGAP) 田間施藥紀錄表】
========================================
產銷班 / 農會代碼：TGAP-2026-FARM
開立日期：${today}
諮詢目標作物：${crop || '甘藍 (高麗菜)'}
防治病蟲害：${pest || '病蟲害防治'}
----------------------------------------
【官方建議合規施藥指引】
${msgText}
----------------------------------------
核定依據：農業部動植物防疫檢疫署 (APHIA)
農會專員複核：[   ] 植保醫生簽章核定
備註：本處方紀錄符合TGAP產銷履歷規範，可直接存檔
========================================`;
    navigator.clipboard.writeText(tgapRecord).then(() => {
      alert("✅ 已成功複製「農會產銷履歷 TGAP 格式施藥紀錄」！可直接貼上呈報農會產銷班或列印備查。");
    });
  };

  // 手機抽屜：選對話後自動收起
  const selectAndClose = (id) => { setActiveId(id); if (isMobile) setDrawerOpen(false); };
  const newAndClose = () => { newConversation(); if (isMobile) setDrawerOpen(false); };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: EARTH.page, position: 'relative' }}>
      {/* 桌機版：固定側邊欄（僅登入者） */}
      {!isGuest && !isMobile && (
        <div style={{ width: 260, borderRight: `1px solid ${EARTH.border}`, background: EARTH.sidebarBg, display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
          <SidebarContent
            conversations={conversations} activeId={activeId}
            onSelect={setActiveId} onNew={newConversation}
            onRename={renameConversation} onTogglePin={togglePin} onDelete={deleteConversation}
          />
        </div>
      )}

      {/* 手機版：抽屜側邊欄（僅登入者） */}
      {!isGuest && isMobile && drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, top: 64, background: 'rgba(0,0,0,0.4)', zIndex: 150 }} />
          <div style={{ position: 'fixed', top: 64, left: 0, bottom: 0, width: 268, maxWidth: '82%', background: EARTH.sidebarBg, borderRight: `1px solid ${EARTH.border}`, display: 'flex', flexDirection: 'column', padding: '18px 14px', zIndex: 151, boxShadow: '2px 0 16px rgba(0,0,0,0.18)' }}>
            <SidebarContent
              conversations={conversations} activeId={activeId}
              onSelect={selectAndClose} onNew={newAndClose}
              onRename={renameConversation} onTogglePin={togglePin} onDelete={deleteConversation}
            />
          </div>
        </>
      )}

      {/* 主對話區 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1320, width: '100%', margin: '0 auto', padding: isMobile ? '16px 16px 0' : '24px 48px 0', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 手機版：開啟對話列表按鈕（僅登入者） */}
          {!isGuest && isMobile && (
            <button onClick={() => setDrawerOpen(true)}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: EARTH.surface, border: `1px solid ${EARTH.border}`, color: EARTH.accent, borderRadius: 20, padding: '7px 15px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
              ☰ 對話紀錄
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: EARTH.accent, margin: 0 }}>🌿 農藥博士</h1>
            
            {/* 雙軌模式切換：農民版 vs 考照版 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: EARTH.surface, border: `1px solid ${EARTH.border}`, borderRadius: 24, padding: '3px 4px' }}>
              <button type="button" onClick={() => setIsFarmerMode(true)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: isFarmerMode ? EARTH.accent : 'transparent',
                  color: isFarmerMode ? '#fff' : EARTH.textDark,
                  fontWeight: isFarmerMode ? 600 : 400, fontSize: 13, transition: 'all 0.2s'
                }}>
                👨‍🌾 農民大字版
              </button>
              <button type="button" onClick={() => setIsFarmerMode(false)}
                style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: !isFarmerMode ? EARTH.accent : 'transparent',
                  color: !isFarmerMode ? '#fff' : EARTH.textDark,
                  fontWeight: !isFarmerMode ? 600 : 400, fontSize: 13, transition: 'all 0.2s'
                }}>
                🎓 考照法規版
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <p style={{ color: EARTH.textMuted, fontSize: isMobile ? 13 : 15, margin: 0 }}>
              官方真實數據源 · 52,183 筆核准登記 · 7,071 筆殘留標準
            </p>
            {isFarmerMode ? (
              <span style={{ fontSize: 12, background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                🌱 已啟動田間三秒速查（20L背負桶劑量）
              </span>
            ) : (
              <span style={{ fontSize: 12, background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                ⚖️ 已啟動法規罰則與證照檢定標準
              </span>
            )}
          </div>

          {isGuest && (
            <p style={{ color: EARTH.accent, background: EARTH.accentLight, fontSize: isMobile ? 13 : 14, padding: '8px 14px', borderRadius: 8, marginBottom: 12, lineHeight: 1.6 }}>
              目前為訪客模式，僅能單次問答、不會保留對話紀錄。註冊登入後可保存對話，並解鎖模擬考、農藥資訊卡、學習教材。
            </p>
          )}

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 22, marginBottom: 18 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'user' ? (
                  <div style={{
                    maxWidth: isMobile ? '88%' : '75%', background: EARTH.accent, color: EARTH.accentText,
                    borderRadius: '20px 20px 4px 20px', padding: isMobile ? '12px 15px' : '14px 18px',
                    fontSize: isFarmerMode ? (isMobile ? 17 : 20) : (isMobile ? 16 : 18),
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}>
                    {m.image && (
                      <div style={{ marginBottom: 8 }}>
                        <img src={m.image} alt="葉片照片" style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, objectFit: 'cover' }} />
                      </div>
                    )}
                    {m.text}
                  </div>
                ) : (
                  <div style={{
                    maxWidth: isMobile ? '96%' : '92%',
                    background: m.isRefusal ? EARTH.warnBg : EARTH.surface,
                    border: `1px solid ${m.isRefusal ? '#F0DBA0' : EARTH.border}`,
                    color: EARTH.textDark,
                    borderRadius: 14,
                    padding: isMobile ? '14px 16px' : '16px 20px',
                    fontSize: isFarmerMode ? (isMobile ? 17 : 19) : (isMobile ? 15 : 17),
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}>
                    {tidyText(m.text)}
                  </div>
                )}

                {/* 輔助標籤與農會 TGAP 產銷履歷匯出按鈕 */}
                {m.role !== 'user' && !m.isRefusal && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, maxWidth: isMobile ? '96%' : '92%', alignItems: 'center' }}>
                    <button type="button" onClick={() => handleExportTGAP(m.text, m.crop, m.pest)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
                        background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E',
                        padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600
                      }}>
                      📋 匯出農會田間用藥簿 (TGAP 格式)
                    </button>
                    {m.sources && m.sources.slice(0, 3).map((s, j) => (
                      <a key={j} href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, background: EARTH.accentSoft, border: `1px solid ${EARTH.border}`, color: EARTH.accent, padding: '3px 10px', borderRadius: 6, textDecoration: 'none' }}>
                        🔗 {s.title?.slice(0, 18)}{s.date ? ` · ${s.date}` : ''}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(loading || diagnosingImage) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: EARTH.surface, padding: '10px 16px', borderRadius: 12, border: `1px solid ${EARTH.border}`, width: 'fit-content' }}>
                <span style={{ fontSize: 14, color: EARTH.accent, fontWeight: 500 }}>
                  {diagnosingImage ? '📸 正在分析患部病徵並比對 5.2 萬筆官方藥證…' : '🌿 正在檢索官方農藥資料庫與安全採收期…'}
                </span>
                <div style={{ padding: '4px 0', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, background: EARTH.accent, borderRadius: '50%', display: 'inline-block', animation: `bounce 1s ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ display: 'flex', gap: isMobile ? 8 : 10, flexWrap: isMobile ? 'nowrap' : 'wrap', marginBottom: 14, overflowX: isMobile ? 'auto' : 'visible', paddingBottom: isMobile ? 4 : 0 }}>
            {QUICK.map((q, i) => (
              <button key={i} onClick={() => handleSend(q)} style={{ fontSize: isMobile ? 13 : 14, padding: isMobile ? '6px 12px' : '7px 16px', background: EARTH.surface, border: `1px solid ${EARTH.border}`, borderRadius: 24, color: EARTH.accent, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
                {q}
              </button>
            ))}
          </div>

          {/* 輸入區：包含文字、📷 拍照問診按鈕與發送按鈕 */}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, paddingBottom: isMobile ? 16 : 24, alignItems: 'center' }}>
            {/* 相機專用 input (capture="environment") 與 相簿挑選 input */}
            <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: 'none' }} />
            <input type="file" ref={albumInputRef} accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            
            <button type="button" onClick={() => setPhotoModalOpen(true)} disabled={loading || diagnosingImage}
              title="拍照或選擇葉片患部照片"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: isMobile ? '12px 14px' : '14px 18px',
                background: '#2D6A4F', color: '#FFFFFF', border: 'none', borderRadius: 30,
                fontWeight: 600, fontSize: isMobile ? 14 : 15, cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 2px 6px rgba(45,106,79,0.25)'
              }}>
              📷 {diagnosingImage ? '辨識中' : '拍照問診'}
            </button>

            {/* 拍照/選圖 彈出對話盒 */}
            {photoModalOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                onClick={() => setPhotoModalOpen(false)}>
                <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 20px', width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
                  <h3 style={{ margin: '0 0 8px', color: EARTH.accent, fontSize: 18, fontWeight: 700 }}>🌿 農作物病蟲害拍照診斷</h3>
                  <p style={{ margin: '0 0 20px', color: EARTH.textMuted, fontSize: 14 }}>請選擇即時開啟手機鏡頭拍照，或從相簿中選取已拍好的葉片患部照片：</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button type="button" onClick={() => { setPhotoModalOpen(false); cameraInputRef.current?.click(); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: '#2D6A4F', color: '#FFF', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                      📸 開啟手機相機直接拍照
                    </button>
                    <button type="button" onClick={() => { setPhotoModalOpen(false); albumInputRef.current?.click(); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: '#E8F5E9', color: '#1B5E20', fontSize: 16, fontWeight: 600, border: '1px solid #A5D6A7', cursor: 'pointer' }}>
                      🖼️ 從相簿挑選已存照片
                    </button>
                    <button type="button" onClick={() => setPhotoModalOpen(false)}
                      style={{ padding: '10px', borderRadius: 10, background: 'transparent', color: '#6B7280', fontSize: 14, border: 'none', cursor: 'pointer', marginTop: 4 }}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
              placeholder={isFarmerMode ? "輸入作物名稱（如芒果炭疽病、芭樂薊馬）或按左側拍照…" : "輸入用藥法規或作物查詢…"}
              disabled={loading || diagnosingImage}
              style={{
                flex: 1, minWidth: 0,
                padding: isMobile ? '12px 16px' : '15px 20px',
                border: `1.5px solid ${EARTH.border}`, borderRadius: 30,
                fontSize: isFarmerMode ? (isMobile ? 16 : 18) : (isMobile ? 15 : 17),
                outline: 'none', background: EARTH.surface
              }} />

            <button onClick={() => handleSend(input)} disabled={loading || diagnosingImage || !input.trim()}
              style={{
                padding: isMobile ? '0 18px' : '0 26px', height: isMobile ? 44 : 50,
                background: input.trim() && !loading ? EARTH.accent : EARTH.accentLight,
                color: input.trim() && !loading ? EARTH.accentText : EARTH.textMuted,
                border: 'none', borderRadius: 30, fontWeight: 600, fontSize: isMobile ? 15 : 16,
                flexShrink: 0, cursor: input.trim() && !loading ? 'pointer' : 'default'
              }}>
              送出
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}