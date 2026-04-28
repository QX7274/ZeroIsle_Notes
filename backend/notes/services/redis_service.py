import json
import logging
from django.conf import settings
from django.core.cache import cache
import redis

logger = logging.getLogger(__name__)

class RedisService:
    """
    Service for managing collaboration state in Redis.
    Structure:
    - note:session:{note_id}:users -> Hash {user_id: user_info_json}
    - note:session:{note_id}:cursors -> Hash {user_id: cursor_info_json}
    - note:version:{note_id} -> String (int)
    """

    def __init__(self):
        # Initialize Redis connection using settings or defaults
        self.redis_host = getattr(settings, 'REDIS_HOST', '127.0.0.1')
        self.redis_port = getattr(settings, 'REDIS_PORT', 6379)
        self.TTL = 3600 * 24  # 24 hours TTL for idle sessions
        self._r = None
        
    @property
    def r(self):
        """Lazy connection with error handling"""
        if self._r is None:
            try:
                self._r = redis.Redis(host=self.redis_host, port=self.redis_port, db=0, decode_responses=True)
                self._r.ping()
            except redis.ConnectionError as e:
                logger.error(f"Redis connection failed: {e}")
                # For basic functionality, we might not want to crash, 
                # but for collaboration, Redis is essential. 
                # We'll return a mock or re-raise depending on strictness.
                # Here we allow _r to remains None and handle it in methods.
                pass
        return self._r

    def _check_connection(self):
        if self.r is None:
            logger.error("Redis service is not available")
            return False
        return True

    def _get_user_key(self, note_id):
        return f"note:session:{note_id}:users"

    def _get_cursor_key(self, note_id):
        return f"note:session:{note_id}:cursors"

    def add_user(self, note_id, user_id, user_info):
        """Add or update a user in the session"""
        if not self._check_connection(): return
        try:
            key = self._get_user_key(note_id)
            self.r.hset(key, user_id, json.dumps(user_info))
            self.r.expire(key, self.TTL)
        except Exception as e:
            logger.error(f"Redis error in add_user: {e}")

    def remove_user(self, note_id, user_id):
        """Remove a user from the session"""
        if not self._check_connection(): return
        try:
            key = self._get_user_key(note_id)
            self.r.hdel(key, user_id)
            
            # Also remove their cursor
            cursor_key = self._get_cursor_key(note_id)
            self.r.hdel(cursor_key, user_id)
        except Exception as e:
            logger.error(f"Redis error in remove_user: {e}")

    def get_users(self, note_id):
        """Get all users in the session"""
        if not self._check_connection(): return {}
        try:
            key = self._get_user_key(note_id)
            users_raw = self.r.hgetall(key)
            return {uid: json.loads(data) for uid, data in users_raw.items()}
        except Exception as e:
            logger.error(f"Redis error in get_users: {e}")
            return {}

    def update_cursor(self, note_id, user_id, cursor_data):
        """Update a user's cursor position"""
        if not self._check_connection(): return
        try:
            key = self._get_cursor_key(note_id)
            self.r.hset(key, user_id, json.dumps(cursor_data))
            self.r.expire(key, self.TTL)
        except Exception as e:
            logger.error(f"Redis error in update_cursor: {e}")

    def get_cursors(self, note_id):
        """Get all cursors in the session"""
        if not self._check_connection(): return {}
        try:
            key = self._get_cursor_key(note_id)
            cursors_raw = self.r.hgetall(key)
            return {uid: json.loads(data) for uid, data in cursors_raw.items()}
        except Exception as e:
            logger.error(f"Redis error in get_cursors: {e}")
            return {}

    def get_user_count(self, note_id):
        if not self._check_connection(): return 0
        try:
            return self.r.hlen(self._get_user_key(note_id))
        except Exception as e:
             logger.error(f"Redis error in get_user_count: {e}")
             return 0

    # Optimistic Locking / Versioning Support
    def get_version(self, note_id):
        if not self._check_connection(): return 0
        try:
            return int(self.r.get(f"note:version:{note_id}") or 0)
        except Exception as e:
             logger.error(f"Redis error in get_version: {e}")
             return 0

    def increment_version(self, note_id):
        if not self._check_connection(): return 0
        try:
            return self.r.incr(f"note:version:{note_id}")
        except Exception as e:
             logger.error(f"Redis error in increment_version: {e}")
             return 0

    # Vector Clock Support for CRDT
    def get_vector_clock(self, note_id):
        """Get the vector clock for a note"""
        if not self._check_connection(): return {}
        try:
            key = f"note:vectorclock:{note_id}"
            data = self.r.get(key)
            if data:
                return json.loads(data)
            return {}
        except Exception as e:
             logger.error(f"Redis error in get_vector_clock: {e}")
             return {}

    def set_vector_clock(self, note_id, vector_clock):
        """Set the vector clock for a note"""
        if not self._check_connection(): return
        try:
            key = f"note:vectorclock:{note_id}"
            self.r.set(key, json.dumps(vector_clock))
            self.r.expire(key, self.TTL)
        except Exception as e:
            logger.error(f"Redis error in set_vector_clock: {e}")

    def compare_clocks(self, clock_a, clock_b):
        """
        Compare two vector clocks.
        Returns:
        - -1 if clock_a < clock_b (happened before)
        - 1 if clock_a > clock_b (happened after)
        - 0 if clock_a == clock_b (same state)
        - 2 if concurrent (conflict)
        """
        keys = set(clock_a.keys()) | set(clock_b.keys())
        a_le_b = True
        b_le_a = True

        for key in keys:
            val_a = int(clock_a.get(key, 0))
            val_b = int(clock_b.get(key, 0))

            if val_a > val_b:
                a_le_b = False
            if val_b > val_a:
                b_le_a = False

        if a_le_b and b_le_a:
            return 0
        if a_le_b:
            return -1
        if b_le_a:
            return 1
        return 2

    def detect_conflict(self, note_id, incoming_clock):
        """
        Check if the incoming update conflicts with the current state.
        Returns:
        - True if conflict (concurrent)
        - False if consistent (incoming >= current)
        - Raises ValueError if incoming is stale (incoming < current)
        """
        current = self.get_vector_clock(note_id)
        comparison = self.compare_clocks(incoming_clock, current)

        if comparison == 2:
            return True # Conflict
        if comparison == -1:
            # Incoming is older than current
            # In some systems this is a conflict, in others just ignored.
            # We'll treat it as a special case or conflict.
            # For now, let's log it and treat as conflict to force easy resolution/re-sync
            logger.warning(f"Stale update detected for note {note_id}")
            return True
        
        return False
