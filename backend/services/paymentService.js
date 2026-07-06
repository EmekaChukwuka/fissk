import axios from 'axios';
import crypto from 'crypto';

class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
    this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    
    if (!this.secretKey) {
      console.warn('⚠️ PAYSTACK_SECRET_KEY is not set in environment variables');
    }
  }

  // ===== INITIALIZE PAYMENT =====
  async initializePayment(email, amount, metadata = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to kobo
          currency: 'NGN',
          metadata: {
            custom_fields: Object.entries(metadata).map(([key, value]) => ({
              display_name: key,
              variable_name: key,
              value: value
            }))
          },
          callback_url: `${process.env.FRONTEND_URL}/payment-verify.html`
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data.data,
        reference: response.data.data.reference,
        authorizationUrl: response.data.data.authorization_url
      };
    } catch (error) {
      console.error('Paystack initialize error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== VERIFY PAYMENT =====
  async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      const data = response.data.data;
      
      return {
        success: true,
        data: data,
        status: data.status,
        amount: data.amount / 100, // Convert from kobo
        reference: data.reference,
        paidAt: data.paidAt
      };
    } catch (error) {
      console.error('Paystack verify error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== VERIFY WEBHOOK SIGNATURE =====
  verifyWebhookSignature(signature, payload) {
    if (!this.webhookSecret) {
      console.warn('⚠️ PAYSTACK_WEBHOOK_SECRET is not set, webhook verification disabled');
      return true;
    }

    try {
      const hash = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  // ===== REFUND PAYMENT =====
  async refundPayment(reference, amount = null) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/refund`,
        {
          transaction: reference,
          amount: amount ? amount * 100 : undefined
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Paystack refund error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== GET TRANSACTION BY REFERENCE =====
  async getTransaction(reference) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Paystack get transaction error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

export default new PaymentService();