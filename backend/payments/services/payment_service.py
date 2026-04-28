"""
Payment Service Interface

Unified interface for payment providers (Stripe, WeChat Pay).
"""

import logging
import time
from django.conf import settings
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class PaymentProvider:
    """Abstract base class for payment providers"""
    
    def create_customer(self, user) -> str:
        """Create a customer on the provider side"""
        raise NotImplementedError
        
    def create_subscription(self, customer_id: str, price_id: str, metadata: Dict = None) -> Dict:
        """Create a subscription"""
        raise NotImplementedError
        
    def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel a subscription"""
        raise NotImplementedError
        
    def handle_webhook(self, payload: Dict, signature: str) -> Dict:
        """Handle incoming webhooks"""
        raise NotImplementedError

class StripeProvider(PaymentProvider):
    """Stripe Implementation"""
    
    def __init__(self):
        self.api_key = getattr(settings, 'STRIPE_API_KEY', None)
        self.webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
        if self.api_key:
            import stripe
            stripe.api_key = self.api_key
            self.stripe = stripe
        else:
            logger.warning("Stripe API key not configured")
            self.stripe = None
        
    def create_customer(self, user) -> str:
        if not self.stripe:
            return f"cus_mock_{user.id}"
            
        try:
            customer = self.stripe.Customer.create(
                email=user.email,
                metadata={'user_id': str(user.id)},
                name=user.username
            )
            return customer.id
        except Exception as e:
            logger.error(f"Stripe create_customer failed: {e}")
            raise

    def create_subscription(self, customer_id: str, price_id: str, metadata: Dict = None) -> Dict:
        if not self.stripe:
            return {'id': f"sub_mock_{customer_id}", 'status': 'active'}
            
        try:
            subscription = self.stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_id}],
                metadata=metadata or {},
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                expand=['latest_invoice.payment_intent']
            )
            
            return {
                'id': subscription.id,
                'status': subscription.status,
                'client_secret': subscription.latest_invoice.payment_intent.client_secret,
            }
        except Exception as e:
            logger.error(f"Stripe create_subscription failed: {e}")
            raise

    def handle_webhook(self, payload: bytes, signature: str) -> Dict:
        if not self.stripe:
            return {}
            
        try:
            event = self.stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return event
        except ValueError as e:
            raise ValueError("Invalid payload")
        except self.stripe.error.SignatureVerificationError as e:
            raise ValueError("Invalid signature")

class WeChatPayProvider(PaymentProvider):
    """WeChat Pay Implementation (Native)"""
    
    def __init__(self):
        self.app_id = getattr(settings, 'WECHAT_APP_ID', None)
        self.mch_id = getattr(settings, 'WECHAT_MCH_ID', None)
        self.api_key = getattr(settings, 'WECHAT_PAY_API_KEY', None)
        
        if self.app_id and self.mch_id and self.api_key:
            from wechatpy.pay import WeChatPay
            self.client = WeChatPay(
                appid=self.app_id,
                api_key=self.api_key,
                mch_id=self.mch_id
            )
        else:
            logger.warning("WeChat Pay not configured")
            self.client = None
        
    def create_transaction(self, user, amount, description) -> Dict:
        if not self.client:
            return {'prepay_id': f"wx_mock_{user.id}", 'qr_code': 'weixin://wxpay/bizpayurl?pr=mock'}
            
        try:
            # Amount is in cents
            order = self.client.order.create(
                trade_type="NATIVE",
                body=description,
                total_fee=int(amount * 100),
                notify_url=getattr(settings, 'WECHAT_PAY_NOTIFY_URL', ''),
                out_trade_no=f"order_{user.id}_{int(time.time())}"
            )
            return order
        except Exception as e:
            logger.error(f"WeChat Pay create_transaction failed: {e}")
            raise

class PaymentService:
    """
    Main Service to interact with payments.
    """
    
    PROVIDERS = {
        'stripe': StripeProvider,
        'wechat': WeChatPayProvider
    }
    
    @classmethod
    def get_provider(cls, provider_name: str) -> PaymentProvider:
        provider_class = cls.PROVIDERS.get(provider_name)
        if not provider_class:
            raise ValueError(f"Invalid provider: {provider_name}")
        return provider_class()
    
    @classmethod
    def process_subscription_checkout(cls, user, plan_id, provider_name='stripe'):
        """
        Initiate a checkout session for subscription.
        """
        provider = cls.get_provider(provider_name)
        
        # 1. Get/Create customer (would typically look up in DB first)
        # For simplicity, we create specific logic here.
        # In production, check UserSettings or PaymentProfile model.
        customer_id = provider.create_customer(user)
        
        # 2. Create Subscription
        result = provider.create_subscription(customer_id, plan_id)
        
        return result

# Singleton
payment_service = PaymentService()
