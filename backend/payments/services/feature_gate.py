"""
Feature Gating Service

Controls access to features based on User Subscription Plan.
"""

import logging
from typing import Dict, Any, List
from payments.mongodb_models import Subscription

logger = logging.getLogger(__name__)

class FeatureGateService:
    """
    Service to check if a user has access to a specific feature.
    """
    
    # Feature configurations
    FEATURES = {
        'cloud_vector_search': {
            'min_plan': 'pro',
            'description': 'Access to Cloud Vector DB (Milvus/Pinecone)'
        },
        'unlimited_storage': {
            'min_plan': 'pro',
            'description': 'Unlimited note storage'
        },
        'advanced_analysis': {
            'min_plan': 'pro',
            'description': 'Advanced AI analysis models'
        },
        'team_collaboration': {
            'min_plan': 'enterprise',
            'description': 'Team workspaces and sharing'
        },
        'api_access': {
            'min_plan': 'enterprise',
            'description': 'Developer API access'
        }
    }
    
    # Plan hierarchy (higher index = higher tier)
    PLAN_HIERARCHY = ['free', 'pro', 'enterprise']
    
    @classmethod
    def check_access(cls, user, feature_name: str) -> bool:
        """
        Check if user has access to a feature.
        
        Args:
            user: User instance
            feature_name: Name of the feature to check
            
        Returns:
            bool: True if access granted
        """
        if user.is_superuser:
            return True
            
        feature_config = cls.FEATURES.get(feature_name)
        if not feature_config:
            # If feature not defined, assuming it's free/open or doesn't exist.
            # Defaulting to True for safety, or False? 
            # Let's log warning and return False to be safe.
            logger.warning(f"Feature {feature_name} not defined in FeatureGateService")
            return False
            
        required_plan = feature_config['min_plan']
        
        # Get user's active subscription
        # Optimized: In a real app, cache this in Redis or User session
        try:
            subscription = Subscription.objects.get(user=user)
        except Subscription.DoesNotExist:
            subscription = Subscription(user=user, plan='free', status='active')
            
        # Check status
        if not subscription.is_active():
            # If sub is not active, fallback to free tier
            user_plan = 'free'
        else:
            user_plan = subscription.plan
            
        # Compare tiers
        try:
            user_tier_idx = cls.PLAN_HIERARCHY.index(user_plan)
            required_tier_idx = cls.PLAN_HIERARCHY.index(required_plan)
            
            return user_tier_idx >= required_tier_idx
            
        except ValueError:
            logger.error(f"Invalid plan name encountered: {user_plan} or {required_plan}")
            return False

    @classmethod
    def get_user_tier(cls, user) -> str:
        """Get the effective tier name for a user"""
        if user.is_superuser:
            return 'enterprise'
            
        try:
            subscription = Subscription.objects.get(user=user)
            if subscription.is_active():
                return subscription.plan
        except Subscription.DoesNotExist:
            pass
            
        return 'free'

# Singleton
feature_gate = FeatureGateService()
