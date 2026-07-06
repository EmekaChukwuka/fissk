import Payment from '../models/Payment.js';
import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';
import User from '../models/User.js';
import paymentService from '../services/paymentService.js';
import emailService from '../services/emailService.js';

// ===== GENERATE UNIQUE REFERENCE =====
function generateReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FISSK-${timestamp}-${random}`;
}

// ===== INITIALIZE PAYMENT =====
export const initializePayment = async (req, res) => {
  try {
    const { classId } = req.body;
    const userId = req.user.id;

    // Get user and class data
    const user = await User.findById(userId);
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if class is free
    if (classData.isFree || classData.price === 0) {
      return res.status(400).json({
        success: false,
        message: 'This class is free. No payment required.'
      });
    }

    // Check if user already enrolled
    const existingEnrollment = await Enrollment.findOne({
      userId: userId,
      classId: classId,
      paymentStatus: 'paid'
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You already have access to this class'
      });
    }

    // Validate price
    if (classData.price < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price. Minimum price is ₦1,000'
      });
    }

    // Generate reference
    const reference = generateReference();

    // Initialize payment with Paystack
    const result = await paymentService.initializePayment(
      user.email,
      classData.price,
      {
        classId: classId,
        userId: userId,
        instructorId: classData.instructorId,
        className: classData.title,
        reference: reference
      }
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
        error: result.error
      });
    }

    // Create payment record
    const payment = new Payment({
      user: userId,
      class: classId,
      instructor: classData.instructorId,
      amount: classData.price,
      reference: reference,
      status: 'pending',
      platformFee: classData.price * 0.3,  // 30%
      instructorEarning: classData.price * 0.7, // 70%
      metadata: {
        className: classData.title,
        studentEmail: user.email,
        studentName: `${user.firstName} ${user.lastName}`
      }
    });

    await payment.save();

    // Also create a pending enrollment
    const enrollment = new Enrollment({
      userId: userId,
      classId: classId,
      paymentReference: reference,
      paymentStatus: 'pending',
      amountPaid: classData.price,
      accessType: 'paid'
    });

    await enrollment.save();

    res.json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: reference,
        payment: payment
      }
    });

  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize payment',
      error: error.message
    });
  }
};

// ===== VERIFY PAYMENT =====
export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Reference is required'
      });
    }

    // Find payment record
    const payment = await Payment.findOne({ reference })
      .populate('user')
      .populate('class')
      .populate('instructor');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // If already successful, return success
    if (payment.status === 'success') {
      const enrollment = await Enrollment.findOne({
        userId: payment.user._id,
        classId: payment.class._id,
        paymentStatus: 'paid'
      });

      return res.json({
        success: true,
        message: 'Payment already verified',
        payment: payment,
        enrollment: enrollment
      });
    }

    // Verify with Paystack
    const result = await paymentService.verifyPayment(reference);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: result.error
      });
    }

    // Check if payment was successful
    if (result.status !== 'success') {
      payment.status = 'failed';
      await payment.save();

      // Update enrollment
      await Enrollment.findOneAndUpdate(
        { paymentReference: reference },
        { paymentStatus: 'failed' }
      );

      return res.status(400).json({
        success: false,
        message: `Payment status: ${result.status}`
      });
    }

    // Payment successful - update records
    payment.status = 'success';
    payment.paystackData = result.data;
    payment.paidAt = new Date();
    await payment.save();

    // Update enrollment
    const enrollment = await Enrollment.findOneAndUpdate(
      { paymentReference: reference },
      {
        paymentStatus: 'paid',
        paidAt: new Date(),
        accessType: 'paid'
      },
      { new: true }
    );

    // Update class stats
    await Class.findByIdAndUpdate(payment.class._id, {
      $inc: { 
        totalSales: 1,
        totalRevenue: payment.amount
      }
    });

    // Update instructor earnings
    await User.findByIdAndUpdate(payment.instructor._id, {
      $inc: {
        earnings: payment.instructorEarning,
        totalRevenue: payment.instructorEarning,
        totalSales: 1
      }
    });

    // Send email receipt
    try {
      await emailService.sendPaymentReceipt(
        payment.user.email,
        `${payment.user.firstName} ${payment.user.lastName}`,
        {
          courseName: payment.class.title,
          amount: payment.amount,
          reference: payment.reference,
          paidAt: payment.paidAt,
          instructorName: `${payment.instructor.firstName} ${payment.instructor.lastName}`
        }
      );
    } catch (emailError) {
      console.error('Failed to send receipt email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: payment,
      enrollment: enrollment
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// ===== CHECK PAYMENT STATUS =====
export const checkPaymentStatus = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    const enrollment = await Enrollment.findOne({
      userId: userId,
      classId: classId
    });

    if (!enrollment) {
      return res.json({
        success: true,
        enrolled: false,
        paid: false,
        isFree: false,
        message: 'Not enrolled'
      });
    }

    const classData = await Class.findById(classId);

    res.json({
      success: true,
      enrolled: true,
      paid: enrollment.paymentStatus === 'paid',
      isFree: classData?.isFree || false,
      accessType: enrollment.accessType,
      paymentStatus: enrollment.paymentStatus,
      message: enrollment.paymentStatus === 'paid' ? 'Access granted' : 'Payment required'
    });

  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};

// ===== WEBHOOK HANDLER =====
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature
    const isValid = paymentService.verifyWebhookSignature(signature, payload);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = payload.event;
    const data = payload.data;

    console.log(`📨 Webhook received: ${event} for reference: ${data.reference}`);

    // Handle charge.success event
    if (event === 'charge.success') {
      const reference = data.reference;

      // Find payment record
      const payment = await Payment.findOne({ reference })
        .populate('user')
        .populate('class')
        .populate('instructor');

      if (!payment) {
        console.log(`⚠️ Payment not found for reference: ${reference}`);
        return res.status(200).json({ success: true });
      }

      // If already processed, skip
      if (payment.status === 'success') {
        console.log(`✅ Payment already processed: ${reference}`);
        return res.status(200).json({ success: true });
      }

      // Update payment
      payment.status = 'success';
      payment.paystackData = data;
      payment.paidAt = new Date();
      await payment.save();

      // Update enrollment
      const enrollment = await Enrollment.findOneAndUpdate(
        { paymentReference: reference },
        {
          paymentStatus: 'paid',
          paidAt: new Date(),
          accessType: 'paid'
        },
        { new: true, upsert: true }
      );

      // Update class stats
      await Class.findByIdAndUpdate(payment.class._id, {
        $inc: { 
          totalSales: 1,
          totalRevenue: payment.amount
        }
      });

      // Update instructor earnings
      await User.findByIdAndUpdate(payment.instructor._id, {
        $inc: {
          earnings: payment.instructorEarning,
          totalRevenue: payment.instructorEarning,
          totalSales: 1
        }
      });

      // Send email receipt
      try {
        await emailService.sendPaymentReceipt(
          payment.user.email,
          `${payment.user.firstName} ${payment.user.lastName}`,
          {
            courseName: payment.class.title,
            amount: payment.amount,
            reference: payment.reference,
            paidAt: payment.paidAt,
            instructorName: `${payment.instructor.firstName} ${payment.instructor.lastName}`
          }
        );
      } catch (emailError) {
        console.error('Failed to send receipt email:', emailError);
      }

      console.log(`✅ Webhook processed: ${reference}`);
    }

    // Handle charge.failed event
    if (event === 'charge.failed') {
      const reference = data.reference;

      await Payment.findOneAndUpdate(
        { reference },
        { 
          status: 'failed',
          paystackData: data
        }
      );

      await Enrollment.findOneAndUpdate(
        { paymentReference: reference },
        { paymentStatus: 'failed' }
      );

      console.log(`❌ Payment failed: ${reference}`);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// ===== GET USER PAYMENTS =====
export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const payments = await Payment.find({
      user: userId,
      status: 'success'
    })
      .populate('class', 'title description thumbnailUrl')
      .populate('instructor', 'firstName lastName')
      .sort({ paidAt: -1 });

    res.json({
      success: true,
      payments: payments
    });

  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payments',
      error: error.message
    });
  }
};