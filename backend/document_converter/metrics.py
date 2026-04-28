"""
Custom Prometheus metrics for the document_converter app.
"""
from django_prometheus.models import model_signals
from prometheus_client import Counter, Histogram

# Counter for conversion tasks started
conversion_started = Counter(
    'doc_conversion_started_total',
    'Total number of document conversion tasks started.',
    ['source']  # e.g., 'upload', 'base64'
)

# Counter for conversion tasks completed, with status label
conversion_completed = Counter(
    'doc_conversion_completed_total',
    'Total number of document conversion tasks completed.',
    ['status', 'mode']  # status: 'success', 'failed', 'timeout' | mode: 'lite', 'loffice'
)

# Histogram for conversion duration
conversion_duration = Histogram(
    'doc_conversion_duration_seconds',
    'Histogram of document conversion durations.',
    ['mode']
)

# Histogram for input file size
conversion_input_bytes = Histogram(
    'doc_conversion_input_bytes',
    'Histogram of input file sizes for conversion.',
    ['extension']
)

# Histogram for output PDF file size
conversion_output_bytes = Histogram(
    'doc_conversion_output_bytes',
    'Histogram of output PDF file sizes.'
)

# Histogram for number of pages in the converted PDF
conversion_pages = Histogram(
    'doc_conversion_pages_total',
    'Histogram of the number of pages in converted PDFs.'
)

