# -*- coding: utf-8 -*-
"""
build_user_dict.py — 擷取資料庫所有農藥名稱、作物名稱、病蟲害名稱，
生成 Jieba 自定義專業詞庫 (user_dict.txt)。

解決傳統斷詞器將多字化學名（如「三賽唑」切成「三/賽/唑」）導致 BM25 索引失焦的痛點。
執行：python build_user_dict.py
輸出：user_dict.txt
"""
import os
import sys
import pandas as pd

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

DATA_DIR = os.path.dirname(__file__)
CSV_PESTICIDES = os.path.join(DATA_DIR, "all_pesticide_leaf.csv")
CSV_LAW = os.path.join(DATA_DIR, "law_articles.csv")
CSV_QA = os.path.join(DATA_DIR, "qa_pairs.csv")
OUTPUT_DICT = os.path.join(DATA_DIR, "user_dict.txt")


def generate_dict():
    terms = set()

    # 1. 農藥登記主表：作物、農藥中文普通名、病蟲害
    if os.path.exists(CSV_PESTICIDES):
        print(f"📥 讀取 {CSV_PESTICIDES} ...")
        df = pd.read_csv(CSV_PESTICIDES, encoding="utf-8-sig", dtype=str).fillna("")
        for col in ["作物名稱", "農藥中文普通名稱", "病蟲害名稱", "劑型"]:
            if col in df.columns:
                for val in df[col].dropna().unique():
                    val = str(val).strip()
                    if len(val) >= 2 and not val.isdigit() and len(val) <= 20:
                        # 複合名稱若包含空格或頓號，也切分個別詞加入
                        for sub in val.replace("、", " ").replace("/", " ").split():
                            if len(sub) >= 2:
                                terms.add(sub)

    # 2. 法規專有名詞
    if os.path.exists(CSV_LAW):
        df_law = pd.read_csv(CSV_LAW, encoding="utf-8-sig", dtype=str).fillna("")
        for name in df_law.get("法規名稱", []).unique():
            if name:
                terms.add(str(name).strip())

    # 3. 常用農業專有名詞與詞彙
    common_agri_terms = [
        "安全採收期", "施藥間隔", "稀釋倍數", "水懸劑", "乳劑", "可濕性粉劑", "水分散性粒劑",
        "系統性藥劑", "接觸性藥劑", "輪替用藥", "分蘗期", "抽穗期", "孕穗期", "幼苗期",
        "幼果期", "著果期", "開花初期", "落花後", "抗藥性", "植物保護資材", "農藥殘留容許量",
        "有機磷殺蟲劑", "氨基甲酸鹽", "解毒劑", "阿托平", "巴姆", "乙醯膽鹼酯酶", "偽農藥", "劣農藥"
    ]
    for t in common_agri_terms:
        terms.add(t)

    # 排序並寫入 user_dict.txt，每行格式：詞 權重 詞性
    sorted_terms = sorted(terms)
    with open(OUTPUT_DICT, "w", encoding="utf-8") as f:
        for t in sorted_terms:
            f.write(f"{t} 2000 n\n")

    print(f"✅ 完成！已生成自定義詞庫：{OUTPUT_DICT}")
    print(f"   收錄專業農業與化學詞彙共 {len(sorted_terms)} 個。")


if __name__ == "__main__":
    generate_dict()
