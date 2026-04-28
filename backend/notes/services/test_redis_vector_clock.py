
import unittest
from unittest.mock import MagicMock, patch
import json
from notes.services.redis_service import RedisService

class TestRedisVectorClock(unittest.TestCase):
    def setUp(self):
        self.service = RedisService()
        self.service._r = MagicMock()  # Mock the redis client

    def test_compare_clocks_equal(self):
        clock_a = {'u1': 1, 'u2': 2}
        clock_b = {'u1': 1, 'u2': 2}
        result = self.service.compare_clocks(clock_a, clock_b)
        self.assertEqual(result, 0)

    def test_compare_clocks_less(self):
        clock_a = {'u1': 1, 'u2': 2}
        clock_b = {'u1': 1, 'u2': 3}
        result = self.service.compare_clocks(clock_a, clock_b)
        self.assertEqual(result, -1)

    def test_compare_clocks_greater(self):
        clock_a = {'u1': 2, 'u2': 2}
        clock_b = {'u1': 1, 'u2': 2}
        result = self.service.compare_clocks(clock_a, clock_b)
        self.assertEqual(result, 1)

    def test_compare_clocks_concurrent(self):
        clock_a = {'u1': 2, 'u2': 1}
        clock_b = {'u1': 1, 'u2': 2}
        result = self.service.compare_clocks(clock_a, clock_b)
        self.assertEqual(result, 2)

    def test_compare_clocks_missing_keys(self):
        # Missing keys are treated as 0
        clock_a = {'u1': 1}
        clock_b = {'u1': 1, 'u2': 1}
        result = self.service.compare_clocks(clock_a, clock_b)
        self.assertEqual(result, -1)

    def test_detect_conflict_clean(self):
        # Current state
        current = {'u1': 1, 'u2': 2}
        self.service._r.get.return_value = json.dumps(current)
        
        # Incoming update (just consistent or newer)
        incoming = {'u1': 1, 'u2': 3} # newer
        
        conflict = self.service.detect_conflict('note1', incoming)
        self.assertFalse(conflict)

    def test_detect_conflict_concurrent(self):
        # Current state
        current = {'u1': 1, 'u2': 2} # u2 is at v2
        self.service._r.get.return_value = json.dumps(current)
        
        # Incoming update (u1 moved, but u2 is old?)
        incoming = {'u1': 2, 'u2': 1} # u1 is v2, u2 is v1
        
        conflict = self.service.detect_conflict('note1', incoming)
        self.assertTrue(conflict)
        
    def test_detect_conflict_stale(self):
        # Current state
        current = {'u1': 2, 'u2': 2}
        self.service._r.get.return_value = json.dumps(current)
        
        # Incoming update (strictly older)
        incoming = {'u1': 1, 'u2': 1}
        
        conflict = self.service.detect_conflict('note1', incoming)
        self.assertTrue(conflict)

if __name__ == '__main__':
    unittest.main()
