"""Server-lifetime PDF RAG (LangChain + local Ollama)."""

from backend.rag.ingest import clear_documents, ingest_pdf, list_documents
from backend.rag.retrieve import format_context, retrieve_context, retrieve_for_query

__all__ = [
    "clear_documents",
    "format_context",
    "ingest_pdf",
    "list_documents",
    "retrieve_context",
    "retrieve_for_query",
]
