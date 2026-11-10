"""Retrieve PDF chunks and format context for the tutor prompt."""

from __future__ import annotations

from backend.rag.config import RETRIEVE_K
from backend.rag.store import has_documents, similarity_search


def retrieve_for_query(query: str, k: int | None = None) -> tuple[str, list[str]]:
    """Return (formatted_context, unique_source_filenames) for a question."""
    if not has_documents():
        return "", []
        
    docs = similarity_search(query, k=k or RETRIEVE_K)
    
    # --- DEBUG PRINT STATEMENTS ---
    print(f"\n[DEBUG] SEARCHING FOR: '{query}'")
    print(f"[DEBUG] RETRIEVED {len(docs)} CHUNKS:")
    for i, d in enumerate(docs):
        page = d.metadata.get('page', '?')
        preview = d.page_content[:150].replace('\n', ' ')
        print(f"  -> PAGE {page}: {preview}...")
    print("-" * 40 + "\n")
    # ------------------------------
    
    return format_context(docs), source_names(docs)


def retrieve_context(query: str, k: int | None = None) -> str:
    context, _ = retrieve_for_query(query, k=k)
    return context


def source_names(docs) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for doc in docs or []:
        meta = doc.metadata or {}
        source = str(meta.get("source") or "").strip()
        if source and source not in seen:
            seen.add(source)
            names.append(source)
    return names


def format_context(docs) -> str:
    if not docs:
        return ""
    parts: list[str] = []
    for i, doc in enumerate(docs, start=1):
        meta = doc.metadata or {}
        source = meta.get("source", "document")
        page = meta.get("page", "?")
        kind = meta.get("kind", "text")
        header = f"[{i}] {source} (p. {page}, {kind})"
        parts.append(f"{header}\n{doc.page_content.strip()}")
    return "\n\n".join(parts)