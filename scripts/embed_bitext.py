"""
REGENT: Bitext → pgvector embedding pipeline
=============================================
Downloads the Bitext Customer Support dataset, embeds each row using
OpenAI text-embedding-3-small, and inserts into knight_knowledge_base.

Requirements:
    pip install openai supabase pandas python-dotenv tqdm

Usage:
    1. Download dataset from Kaggle:
       https://www.kaggle.com/datasets/bitext/bitext-gen-ai-chatbot-customer-support-dataset
       Save CSV as: scripts/bitext_dataset.csv

    2. Create scripts/.env (or set env vars):
       OPENAI_API_KEY=sk-...
       SUPABASE_URL=https://pesqbkgfsfkqdquhilsv.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=eyJ...

    3. Run:
       python scripts/embed_bitext.py

The script is idempotent — re-running skips rows already in the DB
(checked by source='bitext' count before inserting).
"""

import os
import time
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ── Config ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY         = os.environ["OPENAI_API_KEY"]
SUPABASE_URL           = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CSV_PATH               = os.path.join(os.path.dirname(__file__), "bitext_dataset.csv")
EMBEDDING_MODEL        = "text-embedding-3-small"  # 1536 dims
BATCH_SIZE             = 100   # rows per OpenAI embedding call (max 2048)
RATE_LIMIT_SLEEP       = 0.5   # seconds between batches (stay under RPM)

# Bitext category → friendly label
CATEGORY_MAP = {
    "ACCOUNT":      "account",
    "CANCELLATION_FEE": "billing",
    "CONTACT":      "contact",
    "DELIVERY":     "delivery",
    "FEEDBACK":     "feedback",
    "INVOICE":      "billing",
    "NEWSLETTER":   "newsletter",
    "ORDER":        "orders",
    "PAYMENT":      "billing",
    "REFUND":       "billing",
    "SHIPPING_ADDRESS": "delivery",
    "SUBSCRIPTION": "billing",
}

# ── Clients ───────────────────────────────────────────────────────────────────
openai_client: OpenAI = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def check_existing() -> int:
    """Return count of existing Bitext rows to detect already-imported data."""
    res = supabase.table("knight_knowledge_base") \
        .select("id", count="exact") \
        .eq("source", "bitext") \
        .execute()
    return res.count or 0


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts and return a list of 1536-dim vectors."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


def build_content(row: pd.Series) -> str:
    """
    Combine instruction + response into a single chunk for embedding.
    Format: 'Customer: {query}\nAgent: {response}'
    This gives the vector semantic meaning of the full exchange.
    """
    return f"Customer: {row['instruction'].strip()}\nAgent: {row['response'].strip()}"


def main():
    # ── Validate CSV exists ───────────────────────────────────────────────────
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: Dataset not found at {CSV_PATH}")
        print("Download from: https://www.kaggle.com/datasets/bitext/training-dataset-for-chatbots-and-virtual-assistants")
        return

    # ── Load CSV ──────────────────────────────────────────────────────────────
    print("Loading Bitext dataset...")
    df = pd.read_csv(CSV_PATH)
    print(f"  Rows loaded: {len(df):,}")

    required_cols = {"instruction", "response", "intent", "category"}
    missing = required_cols - set(df.columns)
    if missing:
        print(f"ERROR: CSV missing columns: {missing}")
        print(f"Found columns: {list(df.columns)}")
        return

    # ── Check for existing data (idempotency) ─────────────────────────────────
    existing = check_existing()
    if existing > 0:
        print(f"\nFound {existing:,} existing Bitext rows in knight_knowledge_base.")
        confirm = input("Re-import anyway? This will ADD duplicates. (y/N): ").strip().lower()
        if confirm != "y":
            print("Skipped. Run with a fresh table or delete existing Bitext rows first.")
            return

    # ── Prepare rows ──────────────────────────────────────────────────────────
    df = df.dropna(subset=["instruction", "response"])
    df["content"]  = df.apply(build_content, axis=1)
    df["category"] = df["category"].map(lambda c: CATEGORY_MAP.get(str(c).upper(), str(c).lower()))
    df["intent"]   = df["intent"].str.lower().str.replace(" ", "_")

    total  = len(df)
    chunks = [df.iloc[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]

    print(f"\nEmbedding {total:,} rows in {len(chunks)} batches of {BATCH_SIZE}...")
    print(f"Model: {EMBEDDING_MODEL} | Estimated cost: ~${total * 0.00002 / 1000:.4f}\n")

    inserted = 0
    errors   = 0

    for batch_df in tqdm(chunks, desc="Embedding + inserting"):
        texts = batch_df["content"].tolist()

        try:
            embeddings = embed_batch(texts)
        except Exception as e:
            print(f"\nEmbedding error (batch skipped): {e}")
            errors += len(texts)
            time.sleep(2)
            continue

        rows = []
        for idx, (_, row) in enumerate(batch_df.iterrows()):
            rows.append({
                "content":   row["content"],
                "category":  row["category"],
                "intent":    row["intent"],
                "source":    "bitext",
                "embedding": embeddings[idx],
                # client_id and workspace_id intentionally NULL = global base
            })

        try:
            supabase.table("knight_knowledge_base").insert(rows).execute()
            inserted += len(rows)
        except Exception as e:
            print(f"\nInsert error (batch skipped): {e}")
            errors += len(rows)

        time.sleep(RATE_LIMIT_SLEEP)

    print(f"\n✓ Done. Inserted: {inserted:,} | Errors: {errors:,}")
    print("Knight's knowledge base is ready.")


if __name__ == "__main__":
    main()
