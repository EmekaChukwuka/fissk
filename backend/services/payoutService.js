import axios from 'axios';
import crypto from 'crypto';

class PayoutService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
  }

  // ===== CREATE TRANSFER RECIPIENT =====
  async createRecipient(name, accountNumber, bankCode) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: name,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN'
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
        recipientCode: response.data.data.recipient_code
      };
    } catch (error) {
      console.error('Create recipient error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== INITIATE TRANSFER =====
  async initiateTransfer(amount, recipientCode, reason = 'FISSK Course Earnings') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: 'balance',
          amount: amount * 100, // Convert to kobo
          recipient: recipientCode,
          reason: reason,
          currency: 'NGN'
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
        transferId: response.data.data.id,
        transferCode: response.data.data.transfer_code,
        status: response.data.data.status
      };
    } catch (error) {
      console.error('Initiate transfer error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== GET TRANSFER STATUS =====
  async getTransferStatus(transferCode) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transfer/${transferCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return {
        success: true,
        data: response.data.data,
        status: response.data.data.status
      };
    } catch (error) {
      console.error('Get transfer status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== GET AVAILABLE BALANCE =====
  async getBalance() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/balance`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return {
        success: true,
        data: response.data.data,
        balance: response.data.data[0]?.balance / 100 || 0 // Convert from kobo
      };
    } catch (error) {
      console.error('Get balance error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== FINALIZE TRANSFER (for OTP) =====
  async finalizeTransfer(transferCode, otp) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transfer/finalize_transfer`,
        {
          transfer_code: transferCode,
          otp: otp
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
      console.error('Finalize transfer error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== GET BANK LIST =====
  async getBanks() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return {
        success: true,
        banks: response.data.data
      };
    } catch (error) {
      console.error('Get banks error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ===== VALIDATE BANK ACCOUNT =====
  async validateAccount(accountNumber, bankCode) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank/resolve`,
        {
          params: {
            account_number: accountNumber,
            bank_code: bankCode
          },
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      return {
        success: true,
        data: response.data.data,
        accountName: response.data.data.account_name
      };
    } catch (error) {
      console.error('Validate account error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

export default new PayoutService();