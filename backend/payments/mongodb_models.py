"""
Payments Module MongoDB Models
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, ReferenceField, FloatField, DictField
from users.mongodb_models import User
from django.utils import timezone
import uuid

class Subscription(Document):
    """
    User Subscription Model
    Tracks the current subscription status of a user.
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='User')
    
    # Plan details
    plan = StringField(
        required=True, 
        choices=('free', 'pro', 'enterprise'), 
        default='free',
        verbose_name='Subscription Plan'
    )
    
    # Status
    # active: User has paid and access is granted
    # canceled: User canceled, but access remains until end_date
    # expired: Access revoked
    # past_due: Payment failed, grace period
    status = StringField(
        required=True,
        choices=('active', 'canceled', 'expired', 'past_due', 'trialing'),
        default='active',
        verbose_name='Status'
    )
    
    # Dates
    start_date = DateTimeField(default=timezone.now, verbose_name='Start Date')
    current_period_start = DateTimeField(default=timezone.now, verbose_name='Current Period Start')
    current_period_end = DateTimeField(required=True, verbose_name='Current Period End')
    canceled_at = DateTimeField(verbose_name='Canceled At')
    
    # Provider references
    provider = StringField(choices=('stripe', 'wechat', 'apple', 'manual'), default='manual')
    provider_subscription_id = StringField(verbose_name='Provider Subscription ID', sparse=True)
    provider_customer_id = StringField(verbose_name='Provider Customer ID', sparse=True)
    
    # Config
    auto_renew = BooleanField(default=True, verbose_name='Auto Renew')
    
    meta = {
        'collection': 'subscriptions',
        'indexes': [
            'user',
            'status',
            'provider_subscription_id'
        ],
        'ordering': ['-current_period_start']
    }

    def is_active(self):
        """Check if subscription is currently valid"""
        now = timezone.now()
        return (
            self.status in ['active', 'trialing'] and 
            self.current_period_end > now
        ) or (
            self.status == 'canceled' and 
            self.current_period_end > now
        )

    def __str__(self):
        return f"{self.user} - {self.plan} ({self.status})"


class PaymentTransaction(Document):
    """
    Payment Transaction Log
    Immutable record of all payment attempts.
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()))
    user = ReferenceField(User, required=True, verbose_name='User')
    subscription = ReferenceField(Subscription, verbose_name='Subscription')
    
    # Transaction details
    amount = FloatField(required=True, verbose_name='Amount')
    currency = StringField(required=True, default='CNY', verbose_name='Currency')
    description = StringField(verbose_name='Description')
    
    # Provider info
    provider = StringField(required=True, choices=('stripe', 'wechat', 'apple'), verbose_name='Provider')
    provider_transaction_id = StringField(verbose_name='Provider Transaction ID')
    
    # Status
    status = StringField(
        required=True,
        choices=('pending', 'completed', 'failed', 'refunded'),
        default='pending',
        verbose_name='Status'
    )
    failure_reason = StringField(verbose_name='Failure Reason')
    
    # Metadata
    metadata = DictField(verbose_name='Metadata')
    created_at = DateTimeField(default=timezone.now, verbose_name='Created At')
    updated_at = DateTimeField(default=timezone.now, verbose_name='Updated At')

    meta = {
        'collection': 'payment_transactions',
        'indexes': [
            'user',
            'provider_transaction_id',
            'created_at'
        ],
        'ordering': ['-created_at']
    }

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(PaymentTransaction, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} - {self.amount} {self.currency} - {self.status}"
