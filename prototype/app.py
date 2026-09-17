from flask import Flask, render_template, request, jsonify
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
import google.generativeai as genai
import os
import sqlite3
from datetime import datetime

os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = Flask(__name__)

# ==========================================
# 🧠 1. 設定 Gemini API 大腦
# ==========================================
GEMINI_API_KEY = "AIzaSyA2bPAfRLXRkL4ugef_fDeDM14EePjfhFI"
genai.configure(api_key=GEMINI_API_KEY)
ai_model = genai.GenerativeModel('gemini-2.5-flash')

# 初始化多國語言 Embedding 模型
print("⏳ 正在啟動智慧農藥 RAG 客服系統...")
model_name = "paraphrase-multilingual-MiniLM-L12-v2"
embeddings = HuggingFaceEmbeddings(model_name=model_name)
vectordb = Chroma(persist_directory="pesticide_db", embedding_function=embeddings)
print("✅ 系統準備就緒！")

# ==========================================
# 📁 2. 初始化 SQLite 資料庫
# ==========================================
DATABASE = 'chat_history.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    # 建立對話串表（左側列表）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # 建立對話內容表（右側聊天內容）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            sender TEXT NOT NULL,
            text_content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

# --- 歷史紀錄 API 區塊 ---

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """獲取所有對話串列表（左側清單）"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, created_at FROM chat_sessions ORDER BY id DESC')
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(sessions)

@app.route('/api/sessions', methods=['POST'])
def create_session():
    """新增一個對話串"""
    title = request.json.get('title', '新對話')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chat_sessions (title) VALUES (?)', (title,))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return jsonify({"session_id": session_id, "title": title})

@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    """刪除一個對話串"""
    conn = get_db()
    cursor = conn.cursor()
    # 開啟外鍵支援以確保連帶刪除訊息
    cursor.execute('PRAGMA foreign_keys = ON')
    cursor.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/sessions/<int:session_id>/messages', methods=['GET'])
def get_messages(session_id):
    """獲取特定對話串的所有訊息"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT sender, text_content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC', (session_id,))
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(messages)

# --- 核心對話 API ---

@app.route('/api/search_ajax', methods=['POST'])
def search_ajax():
    user_query = request.form.get('query', '').strip()
    session_id = request.form.get('session_id') # 接收前端傳來的對話串 ID
    
    if not user_query:
        return jsonify({"answer": None})
    
    print(f"\n🔎 收到客服查詢：[{user_query}]")
    
    # RAG 檢索
    results_with_score = vectordb.similarity_search_with_score(user_query, k=5)
    db_context = ""
    if results_with_score:
        matched_contents = [res.page_content for res, score in results_with_score]
        db_context = "\n---\n".join(matched_contents)
        print(f"📚 最終餵給 AI 的資料庫內容共有 {len(matched_contents)} 筆。")
    
    # 呼叫 Gemini
    try:
        prompt = f"""
你是一位親切、專業的台灣智慧農業顧問（植物醫生）。
請根據以下提供的「參考資訊」，來回答使用者的問題。

【參考資訊】：
{db_context if db_context else "（無特定紀錄，請自由發揮專業知識給予防護建議）"}

【使用者問題】：
{user_query}

【請嚴格遵守以下規則】：
1. ⚠️絕對不准提到「資料庫」、「系統紀錄」等字眼！你要表現得像這些知識本來就裝在你的大腦裡一樣。
2. 只挑選與使用者問題相關的那一筆資料來回答，千萬不要混雜無關作物的藥劑。
3. 語氣要像 LINE 智能客服一樣溫暖，可適當使用表情符號。
"""
        response = ai_model.generate_content(prompt)
        final_answer = response.text
        
        if final_answer:
            final_answer = final_answer.replace('*', '') # 過濾星號
        else:
            final_answer = "農民朋友您好！我剛才稍微恍神了一下。請問有什麼問題我可以幫忙呢？"
        
        # 🌟 將對話存入 SQLite 🌟
        if session_id:
            conn = get_db()
            cursor = conn.cursor()
            
            # 檢查這個 session 是否為新對話，如果是，將使用者問的第一句話當作對話標題
            cursor.execute('SELECT title FROM chat_sessions WHERE id = ?', (session_id,))
            session = cursor.fetchone()
            if session and session['title'] == '新對話':
                title_text = user_query[:10] + ('...' if len(user_query) > 10 else '')
                cursor.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', (title_text, session_id))
            
            # 存入使用者訊息
            cursor.execute('INSERT INTO chat_messages (session_id, sender, text_content) VALUES (?, ?, ?)',
                           (session_id, 'user', user_query))
            # 存入 AI 回應
            cursor.execute('INSERT INTO chat_messages (session_id, sender, text_content) VALUES (?, ?, ?)',
                           (session_id, 'ai', final_answer))
            conn.commit()
            conn.close()
        
    except Exception as e:
        print(f"❌ AI 產生失敗，錯誤訊息為: {e}")
        final_answer = "抱歉，目前 AI 連線有點問題，請檢查您的網路或 API Key 是否正常。"

    return jsonify({"answer": final_answer})

if __name__ == '__main__':
    app.run(debug=True, port=5000)