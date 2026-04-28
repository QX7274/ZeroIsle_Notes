"""
Custom exceptions for the document_converter application.
"""

class DocumentConverterError(Exception):
    """Base exception for the document converter service."""
    pass

class ToolNotFoundError(DocumentConverterError):
    """Raised when an external tool (like LibreOffice or Pandoc) is not found."""
    pass

class ConversionTimeoutError(DocumentConverterError):
    """Raised when a conversion process times out."""
    pass

class ConversionFailedError(DocumentConverterError):
    """Raised when a conversion process fails for any other reason."""
    pass

