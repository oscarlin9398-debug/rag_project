# -*- coding: utf-8 -*-
"""
build_all_databases.py — 一鍵建立/重構完整 SQLite 資料庫 (pesticides.db) 與自定義字典。

依序執行：
  1. 匯入農藥登記主表 (pesticides)
  2. 匯入農藥法規條文 (regulations)
  3. 匯入官方/論壇/急救問答集 (qa_knowledge)
  4. 匯入殘留容許量標準 (residue_limits)
  5. 初始化帳號 (users/sessions) 與對話紀錄 (conversations) 資料表
  6. 自動產出 Jieba 自定義專業詞庫 (user_dict.txt)

執行方式：python -X utf8 build_all_databases.py
"""
import os
import sys
import sqlite3
import pandas as pd

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

DATA_DIR = os.path.dirname(__file__)
DB_FILE = os.path.join(DATA_DIR, "pesticides.db")


def log(msg):
    print(f"[{pd.Timestamp.now().strftime('%H:%M:%S')}] {msg}")


def build_pesticides(conn):
    csv_path = os.path.join(DATA_DIR, "all_pesticide_leaf.csv")
    if not os.path.exists(csv_path):
        log(f"⚠️ 找不到 {csv_path}，略過主表匯入")
        return
    log(f"📥 正在匯入農藥登記主表: all_pesticide_leaf.csv ...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig", dtype=str).fillna("")
    df.columns = [c.strip() for c in df.columns]
    df.insert(0, "id", range(1, len(df) + 1))
    df.to_sql("pesticides", conn, if_exists="replace", index=False)
    cur = conn.cursor()
    cur.execute('CREATE INDEX IF NOT EXISTS idx_crop ON pesticides("作物名稱")')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_pesticide ON pesticides("農藥中文普通名稱")')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_bug ON pesticides("病蟲害名稱")')
    conn.commit()
    count = cur.execute("SELECT COUNT(*) FROM pesticides").fetchone()[0]
    log(f"  ✅ pesticides 資料表就緒：共 {count:,} 筆登記資料")


def build_regulations(conn):
    csv_path = os.path.join(DATA_DIR, "law_articles.csv")
    if not os.path.exists(csv_path):
        log(f"⚠️ 找不到 {csv_path}，略過法規表匯入")
        return
    log(f"📥 正在匯入法規資料表: law_articles.csv ...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig", dtype=str).fillna("")
    df.insert(0, "id", range(1, len(df) + 1))
    df.to_sql("regulations", conn, if_exists="replace", index=False)
    cur = conn.cursor()
    cur.execute('CREATE INDEX IF NOT EXISTS idx_law_article ON regulations("條號")')
    conn.commit()
    count = cur.execute("SELECT COUNT(*) FROM regulations").fetchone()[0]
    log(f"  ✅ regulations 資料表就緒：共 {count} 條法規條文")


def build_qa(conn):
    official_path = os.path.join(DATA_DIR, "qa_pairs.csv")
    forum_path = os.path.join(DATA_DIR, "forum_qa.csv")
    poison_path = os.path.join(DATA_DIR, "poison_qa.csv")

    dfs = []
    if os.path.exists(official_path):
        df_off = pd.read_csv(official_path, encoding="utf-8-sig", dtype=str).fillna("")
        df_off = df_off.rename(columns={"章節": "分類"})
        df_off["來源類別"] = "官方標準問答集"
        df_off["來源網址"] = "https://www.acri.gov.tw/Uploads/Item/76022b9d-3394-4aea-8683-c39835555ea5.pdf"
        dfs.append(df_off[["分類", "問題", "答案", "來源類別", "來源網址"]])

    if os.path.exists(forum_path):
        df_forum = pd.read_csv(forum_path, encoding="utf-8-sig", dtype=str).fillna("")
        df_forum = df_forum.rename(columns={"類別": "分類"})
        df_forum["來源類別"] = "線上諮詢真實問答"
        dfs.append(df_forum[["分類", "問題", "答案", "來源類別", "來源網址"]])

    if os.path.exists(poison_path):
        df_poison = pd.read_csv(poison_path, encoding="utf-8-sig", dtype=str).fillna("")
        df_poison["來源類別"] = "中毒急救資訊（台北榮總）"
        dfs.append(df_poison[["分類", "問題", "答案", "來源類別", "來源網址"]])

    if dfs:
        df = pd.concat(dfs, ignore_index=True)
        df = df[df["答案"].str.len() > 0]
        df.insert(0, "id", range(1, len(df) + 1))
        df.to_sql("qa_knowledge", conn, if_exists="replace", index=False)
        cur = conn.cursor()
        cur.execute('CREATE INDEX IF NOT EXISTS idx_qa_category ON qa_knowledge("來源類別")')
        conn.commit()
        count = cur.execute("SELECT COUNT(*) FROM qa_knowledge").fetchone()[0]
        log(f"  ✅ qa_knowledge 資料表就緒：共 {count} 組問答知識")


def build_residue(conn):
    csv_path = os.path.join(DATA_DIR, "residue_limits.csv")
    if not os.path.exists(csv_path):
        log(f"⚠️ 找不到 {csv_path}，略過殘留標準表匯入")
        return
    log(f"📥 正在匯入殘留限量表: residue_limits.csv ...")
    df = pd.read_csv(csv_path, encoding="utf-8-sig", dtype=str).fillna("")
    df.insert(0, "id", range(1, len(df) + 1))
    df.to_sql("residue_limits", conn, if_exists="replace", index=False)
    cur = conn.cursor()
    cur.execute('CREATE INDEX IF NOT EXISTS idx_residue_category ON residue_limits("用途分類")')
    conn.commit()
    count = cur.execute("SELECT COUNT(*) FROM residue_limits").fetchone()[0]
    log(f"  ✅ residue_limits 資料表就緒：共 {count:,} 筆殘留限量")


def build_auth_and_conv(conn):
    log("🔐 正在建立使用者帳號與對話紀錄 Schema ...")
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        messages TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
    )''')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(username)')
    conn.commit()
    log("  ✅ users, sessions, conversations 資料表結構已建立")


def main():
    log("🚀 開始一鍵建置農藥知識問答系統 (Pesticide RAG) 全量資料庫...")
    conn = sqlite3.connect(DB_FILE)
    try:
        build_pesticides(conn)
        build_regulations(conn)
        build_qa(conn)
        build_residue(conn)
        build_auth_and_conv(conn)
    finally:
        conn.close()

    # 產生自定義詞庫
    from build_user_dict import generate_dict
    generate_dict()

    log(f"🎉 全部資料表與自定義字典建置完畢！輸出檔案：{DB_FILE}")


if __name__ == "__main__":
    main()
