"""In-memory TF-IDF based RAG retrieval per workspace."""
from io import BytesIO
from typing import List, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    words = text.split()
    chunks = []
    i = 0
    step = max(1, chunk_size - overlap)
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
        i += step
    return chunks


def extract_text_from_file(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(data))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception:
            return ""
    if name.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""
    # txt, md, or anything else - treat as utf-8 text
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def retrieve_context(query: str, docs: List[Dict], top_k: int = 4) -> str:
    """
    docs: [{ "filename": str, "chunks": [str] }]
    Returns concatenated top_k relevant chunks as context string.
    """
    all_chunks: List[str] = []
    provenance: List[str] = []
    for d in docs:
        for idx, c in enumerate(d.get("chunks", [])):
            all_chunks.append(c)
            provenance.append(f"{d.get('filename', 'doc')}#{idx}")
    if not all_chunks or not query.strip():
        return ""
    try:
        vec = TfidfVectorizer(stop_words="english", max_features=5000)
        matrix = vec.fit_transform(all_chunks + [query])
        sims = cosine_similarity(matrix[-1], matrix[:-1]).flatten()
        import numpy as np
        top_idx = np.argsort(-sims)[:top_k]
        parts = []
        for i in top_idx:
            if sims[i] <= 0:
                continue
            parts.append(f"[Source: {provenance[i]}]\n{all_chunks[i]}")
        return "\n\n---\n\n".join(parts)
    except Exception:
        return ""
