from unittest import TestCase, mock
from datetime import datetime

# Mock Django settings for standalone run
from django.conf import settings
if not settings.configured:
    settings.configure()

from ..services import AnalyticsService
from ..models import AnalyticsReport

class AnalyticsServiceTests(TestCase):

    def setUp(self):
        self.mock_mongo_client = mock.MagicMock()
        self.mock_db = self.mock_mongo_client.get_default_database()
        self.service = AnalyticsService(mongo_client=self.mock_mongo_client)

    def test_get_dashboard_data_aggregation_pipeline(self):
        """Test that the correct aggregation pipeline is built for dashboard data."""
        self.service.get_dashboard_data()
        
        # Check if the aggregate method was called on the 'notes_note' collection
        self.mock_db.notes_note.aggregate.assert_called_once()
        pipeline = self.mock_db.notes_note.aggregate.call_args[0][0]
        
        # Verify the pipeline structure
        self.assertEqual(pipeline[0]['$match']['created_at']['$gte'], mock.ANY)
        self.assertEqual(pipeline[1]['$group']['_id']['$dateToString']['format'], '%Y-%m-%d')
        self.assertEqual(pipeline[1]['$group']['count']['$sum'], 1)

    @patch('admin_system.backend.analytics.tasks.generate_report_task.delay')
    def test_generate_report_async_triggers_task(self, mock_delay):
        """Test that generating a report asynchronously calls the Celery task."""
        # Mock the report object creation
        with mock.patch('admin_system.backend.analytics.models.AnalyticsReport.objects.create') as mock_create:
            mock_report = mock.MagicMock(spec=AnalyticsReport)
            mock_report.id = 1
            mock_create.return_value = mock_report

            report = self.service.generate_report_async('user_activity', 'testuser', {'param': 'value'})

            self.assertIsNotNone(report)
            # Verify that the Celery task was called with the correct report ID
            mock_delay.assert_called_once_with(report.id)

    def test_sanitize_csv_cell_prevents_injection(self):
        """Test that CSV cell sanitization prevents formula injection."""
        injection_strings = {
            "=2+2": "'=2+2",
            "+SUM(A1:A2)": "'+SUM(A1:A2)",
            "-A1": "'-A1",
            "@SUM(A1:A2)": "'@SUM(A1:A2)",
            "safe_string": "safe_string"
        }

        for unsafe, safe in injection_strings.items():
            self.assertEqual(self.service._sanitize_csv_cell(unsafe), safe)

    def test_get_user_analytics_aggregation_pipeline(self):
        """Test the aggregation pipeline for user analytics."""
        self.service.get_user_analytics(datetime.now(), datetime.now())
        self.mock_db.users_user.aggregate.assert_called_once()
        pipeline = self.mock_db.users_user.aggregate.call_args[0][0]

        # Check for the $facet stage, which indicates parallel aggregation
        self.assertIn('$facet', pipeline[1])
        facet_stage = pipeline[1]['$facet']
        self.assertIn('totalUsers', facet_stage)
        self.assertIn('registrationByHour', facet_stage)
        self.assertIn('statusDistribution', facet_stage)

