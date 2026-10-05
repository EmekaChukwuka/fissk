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

    // Check if user ALREADY has paid enrollment
    const existingPaidEnrollment = await Enrollment.findOne({
      userId: userId,
      classId: classId,
      paymentStatus: 'paid'
    });

    if (existingPaidEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You already have access to this class'
      });
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      user: userId,
      class: classId,
      status: 'pending'
    });

    if (existingPayment) {
      // Reuse existing pending payment - reinitialize with Paystack
      const result = await paymentService.initializePayment(
        user.email,
        classData.price,
        {
          classId: classId,
          userId: userId,
          instructorId: classData.instructorId,
          className: classData.title,
          reference: existingPayment.reference
        }
      );

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment',
          error: result.error
        });
      }

      return res.json({
        success: true,
        data: {
          authorizationUrl: result.authorizationUrl,
          reference: existingPayment.reference,
          payment: existingPayment
        }
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
      platformFee: classData.price * 0.3,
      instructorEarning: classData.price * 0.7,
      metadata: {
        className: classData.title,
        studentEmail: user.email,
        studentName: `${user.firstName} ${user.lastName}`
      }
    });

    await payment.save();

    // ===== FIX: Use findOneAndUpdate with upsert instead of `new` =====
    await Enrollment.findOneAndUpdate(
      { userId: userId, classId: classId },
      {
        $set: {
          paymentReference: reference,
          paymentStatus: 'pending',
          amountPaid: classData.price,
          accessType: 'paid',
          lastAccessed: new Date()
        },
        $setOnInsert: {
          userId: userId,
          classId: classId,
          enrolledAt: new Date(),
          progress: 0,
          completed: false,
          progressItems: []
        }
      },
      { upsert: true, new: true }
    );

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

    console.log('Verifying payment:', reference);
    console.log('Current status:', payment.status);

    // If already successful, return success (idempotent)
    if (payment.status === 'success') {
      const enrollment = await Enrollment.findOne({
        userId: payment.user._id,
        classId: payment.class._id
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

      await Enrollment.findOneAndUpdate(
        { paymentReference: reference },
        { paymentStatus: 'failed' }
      );

      return res.status(400).json({
        success: false,
        message: `Payment status: ${result.status}`
      });
    }

    // ============================================================
    // PAYMENT SUCCESSFUL - CREDIT EVERYONE
    // ============================================================

    // 1. Update payment record
    payment.status = 'success';
    payment.paystackData = result.data;
    payment.paidAt = new Date();
    await payment.save();
    console.log('✅ Payment status updated to success');

    // 2. Update enrollment
    const enrollment = await Enrollment.findOneAndUpdate(
      { userId: payment.user._id, classId: payment.class._id },
      {
        paymentStatus: 'paid',
        paidAt: new Date(),
        accessType: 'paid'
      },
      { new: true }
    );
    console.log('✅ Enrollment updated');

    // 3. Update class stats
    await Class.findByIdAndUpdate(payment.class._id, {
      $inc: {
        totalSales: 1,
        totalRevenue: payment.amount
      }
    });
    console.log('✅ Class stats updated');

    // 4. ===== CREDIT INSTRUCTOR =====
    const instructorId = payment.instructor._id || payment.instructor;
    
    const instructorUpdate = await User.findByIdAndUpdate(
      instructorId,
      {
        $inc: {
          earnings: payment.instructorEarning,
          totalRevenue: payment.instructorEarning,
          totalSales: 1
        }
      },
      { new: true }
    );
    
    console.log('✅ Instructor credited:');
    console.log('   - Earnings added:', payment.instructorEarning);
    console.log('   - New earnings balance:', instructorUpdate?.earnings);
    console.log('   - New total revenue:', instructorUpdate?.totalRevenue);

    // 5. Send email receipt
    try {
      await emailService.sendPaymentReceipt(
        payment.user.email,
        `${payment.user.firstName} ${payment.user.lastName}`,
        {
          courseName: payment.class.title,
          amount: payment.amount,
          reference: payment.reference,
          paidAt: payment.paidAt,
          instructorName: `${payment.instructor.firstName} ${payment.instructor.lastName}`,
          classId: payment.class._id
        }
      );
    } catch (emailError) {
      console.error('Failed to send receipt email:', emailError);
    }

    // 6. Notify instructor
    try {
      await emailService.sendInstructorSaleEmail(
        payment.instructor.email,
        `${payment.instructor.firstName} ${payment.instructor.lastName}`,
        {
          courseName: payment.class.title,
          amount: payment.amount,
          studentName: `${payment.user.firstName} ${payment.user.lastName}`,
          studentEmail: payment.user.email,
          paidAt: payment.paidAt,
          instructorEarning: payment.instructorEarning,
          totalEarnings: instructorUpdate?.totalRevenue || 0
        }
      );
    } catch (emailError) {
      console.error('Failed to send instructor email:', emailError);
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: payment,
      enrollment: enrollment,
      instructorEarnings: instructorUpdate?.earnings
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

export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    const isValid = paymentService.verifyWebhookSignature(signature, payload);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const event = payload.event;
    const data = payload.data;

    console.log(`📨 Webhook received: ${event} for reference: ${data.reference}`);

    if (event === 'charge.success') {
      const reference = data.reference;

      const payment = await Payment.findOne({ reference })
        .populate('user')
        .populate('class')
        .populate('instructor');

      if (!payment) {
        console.log(`⚠️ Payment not found: ${reference}`);
        return res.status(200).json({ success: true });
      }

      // Skip if already processed
      if (payment.status === 'success') {
        console.log(`✅ Already processed: ${reference}`);
        return res.status(200).json({ success: true });
      }

      // Update payment
      payment.status = 'success';
      payment.paystackData = data;
      payment.paidAt = new Date();
      await payment.save();

      // Update enrollment
      await Enrollment.findOneAndUpdate(
        { userId: payment.user._id, classId: payment.class._id },
        { paymentStatus: 'paid', paidAt: new Date(), accessType: 'paid' }
      );

      // Update class
      await Class.findByIdAndUpdate(payment.class._id, {
        $inc: { totalSales: 1, totalRevenue: payment.amount }
      });

      // Credit instructor
      const instructorId = payment.instructor._id || payment.instructor;
      await User.findByIdAndUpdate(instructorId, {
        $inc: {
          earnings: payment.instructorEarning,
          totalRevenue: payment.instructorEarning,
          totalSales: 1
        }
      });

      console.log(`✅ Webhook processed: ${reference}`);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
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