import os
import shutil
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# 1. 徹底清理舊資料
db_path = "pesticide_db"
if os.path.exists(db_path):
    try:
        shutil.rmtree(db_path)
        print("🧹 已強制清理舊資料庫")
    except Exception as e:
        print(f"⚠️ 無法自動刪除，請手動刪除 {db_path} 資料夾後再執行。")

# 2. 準備精準資料 (每行獨立)
# 💡 資管專題小技巧：開頭重複兩次作物名稱，可以強迫 AI 模型提高該作物的權重！
raw_data = """
作物：青蔥。青蔥。病害：鏽病。推薦藥劑：亞托敏 (Azoxystrobin)。用法：稀釋 1500 倍。
作物：水稻。水稻。病害：稻熱病。推薦藥劑：亞托敏 (Azoxystrobin)。用法：稀釋 2000 倍。
作物：芒果。芒果。病害：炭疽病。推薦藥劑：亞托敏 (Azoxystrobin)。用法：稀釋 1000 倍。
作物：草莓。草莓。病害：炭疽病。推薦藥劑：百克敏 (Pyraclostrobin)。用法：稀釋 3000 倍。
作物：蓮霧。蓮霧。病害：果腐病。推薦藥劑：百克敏 (Pyraclostrobin)。用法：稀釋 2500 倍。
作物：番茄。番茄。病害：晚疫病。推薦藥劑：百克敏 (Pyraclostrobin)。用法：稀釋 2000 倍。
作物：蔬菜。蔬菜。病害：蚜蟲。推薦藥劑：益達胺 (Imidacloprid)。用法：稀釋 1500 倍。
作物：柑橘。柑橘。病害：粉蝨。推薦藥劑：益達胺 (Imidacloprid)。用法：稀釋 2000 倍。
作物：木瓜。木瓜。病害：紅蜘蛛 (葉蟎)。推薦藥劑：阿巴汀 (Abamectin)。用法：稀釋 3000 倍。
作物：玫瑰。玫瑰。病害：花薊馬。推薦藥劑：阿巴汀 (Abamectin)。用法：稀釋 2500 倍。
作物：梨子。梨子。病害：梨木蛨。推薦藥劑：阿巴汀 (Abamectin)。用法：稀釋 2000 倍。
作物：葡萄。葡萄。病害：露菌病。推薦藥劑：達滅芬 (Dimethomorph)。用法：稀釋 3000 倍。
作物：胡瓜。胡瓜。病害：白粉病。推薦藥劑：待克利 (Difenoconazole)。用法：稀釋 3000 倍。
"""

# 去除空行並轉成列表
lines = [line.strip() for line in raw_data.strip().split('\n') if line.strip()]

# 3. 載入語意模型 (使用支援繁體中文的多國語言版本)
print("⏳ 載入語意模型中...")
model_name = "paraphrase-multilingual-MiniLM-L12-v2"
embeddings = HuggingFaceEmbeddings(model_name=model_name)

# 4. 建立資料庫
print("🚀 正在建立精準向量資料庫...")
vectordb = Chroma.from_texts(
    texts=lines,
    embedding=embeddings,
    persist_directory=db_path
)

print("✅ 重建完成！一條資料就是一個獨立向量。")