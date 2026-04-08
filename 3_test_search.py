import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# 1. 檢查資料庫資料夾是否存在
db_path = "pesticide_db"
if not os.path.exists(db_path):
    print(f"❌ 錯誤：找不到 {db_path} 資料夾，請先執行 2_create_vectordb.py")
else:
    print(f"📂 找到資料庫資料夾：{db_path}")

    # 2. 載入模型 (第一次執行會下載，請耐心等 1-2 分鐘)
    print("⏳ 正在初始化 Embedding 模型 (請稍候)...")
    try:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        print("✅ 模型載入成功！")

        # 3. 連接資料庫
        vectordb = Chroma(persist_directory=db_path, embedding_function=embeddings)
        
        # 4. 測試搜尋
        query = "青蔥鏽病"
        print(f"🔎 正在搜尋關鍵字：'{query}'")
        
        # 搜尋最接近的 1 筆資料
        results = vectordb.similarity_search(query, k=1)

        if len(results) > 0:
            print("\n🎯 【搜尋結果】:")
            print("="*40)
            print(results[0].page_content)
            print("="*40)
        else:
            print("\n⚠️ 資料庫是空的，請檢查 pesticide_info.txt 是否有內容。")

    except Exception as e:
        print(f"❌ 發生錯誤：{e}")

print("\n🏁 程式執行結束。")