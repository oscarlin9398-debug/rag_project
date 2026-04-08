import os
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 1. 指定你的檔案路徑
file_path = "data/pesticide_info.txt" 

if not os.path.exists(file_path):
    print(f"找不到檔案：{file_path}，請確認 data 資料夾內有這個檔案。")
else:
    # 2. 載入文字檔 (使用 TextLoader)
    loader = TextLoader(file_path, encoding='utf-8')
    documents = loader.load()
    print(f"成功載入資料！內容長度：{len(documents[0].page_content)} 字。")

    # 3. 切割文字 (Chunking)
    # 為了測試，我們切小塊一點
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=100,    # 每一塊大約 100 字
        chunk_overlap=20   # 重疊 20 字
    )
    chunks = text_splitter.split_documents(documents)
    
    print(f"文字切割完成，共切成 {len(chunks)} 個小塊。")
    for i, chunk in enumerate(chunks):
        print(f"--- 第 {i+1} 塊內容 ---\n{chunk.page_content}\n")