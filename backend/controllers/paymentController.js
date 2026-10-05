import Payment from '../models/Payment.js';
import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';
import User from '../models/User.js';
import paymentService from '../services/paymentService.js';
import emailService from '../services/emailService.js';
// backend/controllers/paymentController.js

// ===== GENERATE UNIQUE REFERENCE (FISSK format) =====
function generateReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FISSK-${timestamp}-${random}`;
}

export const initializePayment = async (req, res) => {
  try {
    const { classId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classData.isFree || classData.price === 0) {
      return res.status(400).json({ success: false, message: 'This class is free' });
    }

    // Check if already paid
    const existingPaid = await Enrollment.findOne({
      userId, classId, paymentStatus: 'paid'
    });

    if (existingPaid) {
      return res.status(400).json({ success: false, message: 'You already have access' });
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      user: userId, class: classId, status: 'pending'
    });

    // ===== GENERATE YOUR CUSTOM REFERENCE =====
    const myReference = generateReference(); // FISSK-XXXXX-XXXXX

    console.log('🔑 Generated custom reference:', myReference);

    // If there's an existing pending payment, reuse its reference
    const referenceToUse = existingPayment?.reference || myReference;

    // Initialize with Paystack — passing YOUR reference
    const result = await paymentService.initializePayment(
      user.email,
      classData.price,
      {
        classId: classId,
        userId: userId,
        instructorId: classData.instructorId,
        className: classData.title,
        reference: referenceToUse // ← Pass YOUR custom reference
      }
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
        error: result.error
      });
    }

    // ===== CRITICAL: Use whatever reference Paystack returned =====
    // If Paystack accepted your reference, it will be FISSK-XXXXX
    // If Paystack rejected it (duplicate), it will generate T-XXXXX
    const finalReference = result.data.reference;
    
    console.log('✅ Paystack accepted reference:', finalReference);
    console.log('   Is it FISSK format?', finalReference.startsWith('FISSK-'));

    // Create or update payment record
    let payment;
    
    if (existingPayment) {
      // Update existing payment
      existingPayment.reference = finalReference;
      existingPayment.amount = classData.price;
      existingPayment.platformFee = classData.price * 0.3;
      existingPayment.instructorEarning = classData.price * 0.7;
      existingPayment.metadata = {
        ...existingPayment.metadata,
        myReference: referenceToUse,
        className: classData.title
      };
      payment = await existingPayment.save();
    } else {
      // Create new payment
      payment = new Payment({
        user: userId,
        class: classId,
        instructor: classData.instructorId,
        amount: classData.price,
        reference: finalReference, // ← Use Paystack's reference
        status: 'pending',
        platformFee: classData.price * 0.3,
        instructorEarning: classData.price * 0.7,
        metadata: {
          myReference: referenceToUse, // Store your original reference for backup
          className: classData.title,
          studentEmail: user.email,
          studentName: `${user.firstName} ${user.lastName}`
        }
      });
      await payment.save();
    }

    // Upsert enrollment with the final reference
    await Enrollment.findOneAndUpdate(
      { userId, classId },
      {
        $set: {
          paymentReference: finalReference,
          paymentStatus: 'pending',
          amountPaid: classData.price,
          accessType: 'paid'
        },
        $setOnInsert: {
          userId,
          classId,
          enrolledAt: new Date(),
          progress: 0
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: finalReference
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
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    console.log('🔍 Verifying reference:', reference);

    // Find payment — try both the main reference and metadata.myReference
    let payment = await Payment.findOne({ reference })
      .populate('user')
      .populate('class')
      .populate('instructor');

    // Fallback: try metadata.myReference
    if (!payment) {
      console.log('⚠️ Not found by main reference, trying metadata...');
      payment = await Payment.findOne({ 'metadata.myReference': reference })
        .populate('user')
        .populate('class')
        .populate('instructor');
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Already processed?
    if (payment.status === 'success') {
      const enrollment = await Enrollment.findOne({
        userId: payment.user._id,
        classId: payment.class._id
      });
      return res.json({
        success: true,
        message: 'Payment already verified',
        payment,
        enrollment
      });
    }

    // Verify with Paystack — use the reference stored in the payment record
    const result = await paymentService.verifyPayment(payment.reference);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Paystack verification failed',
        error: result.error
      });
    }

    if (result.status !== 'success') {
      payment.status = 'failed';
      await payment.save();
      
      await Enrollment.findOneAndUpdate(
        { paymentReference: payment.reference },
        { paymentStatus: 'failed' }
      );

      return res.status(400).json({
        success: false,
        message: `Payment status: ${result.status}`
      });
    }

    // ===== SUCCESS — CREDIT EVERYONE =====
    payment.status = 'success';
    payment.paystackData = result.data;
    payment.paidAt = new Date();
    await payment.save();

    await Enrollment.findOneAndUpdate(
      { userId: payment.user._id, classId: payment.class._id },
      { paymentStatus: 'paid', paidAt: new Date(), accessType: 'paid' }
    );

    await Class.findByIdAndUpdate(payment.class._id, {
      $inc: { totalSales: 1, totalRevenue: payment.amount }
    });

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

    console.log('✅ Payment credited:');
    console.log('   Reference:', payment.reference);
    console.log('   Instructor earning:', payment.instructorEarning);
    console.log('   New balance:', instructorUpdate?.earnings);

    // Send emails...

    res.json({
      success: true,
      message: 'Payment verified',
      payment,
      enrollment: await Enrollment.findOne({
        userId: payment.user._id,
        classId: payment.class._id
      })
    });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(401).json({ success: false });
    }

    const { event, data } = payload;
    console.log(`📨 Webhook: ${event} - Reference: ${data.reference}`);

    if (event === 'charge.success') {
      const paystackRef = data.reference;

      // ===== Try multiple lookups =====
      let payment = await Payment.findOne({ reference: paystackRef })
        .populate('user')
        .populate('class')
        .populate('instructor');

      // Fallback 1: metadata.myReference
      if (!payment && data.metadata?.reference) {
        console.log('🔍 Trying metadata.reference...');
        payment = await Payment.findOne({ reference: data.metadata.reference })
          .populate('user')
          .populate('class')
          .populate('instructor');
      }

      // Fallback 2: metadata.custom_fields
      if (!payment && data.metadata?.custom_fields) {
        const refField = data.metadata.custom_fields.find(f => f.variable_name === 'reference');
        if (refField?.value) {
          console.log('🔍 Trying custom_fields reference...');
          payment = await Payment.findOne({ reference: refField.value })
            .populate('user')
            .populate('class')
            .populate('instructor');
        }
      }

      // Fallback 3: customer email + amount
      if (!payment && data.customer?.email) {
        console.log('🔍 Trying email + amount lookup...');
        const user = await User.findOne({ email: data.customer.email });
        if (user) {
          payment = await Payment.findOne({
            user: user._id,
            amount: data.amount / 100,
            status: 'pending'
          })
            .sort({ createdAt: -1 })
            .populate('user')
            .populate('class')
            .populate('instructor');

          if (payment) {
            console.log('✅ Found via email + amount');
            // Update the reference to match Paystack's
            payment.reference = paystackRef;
            await payment.save();
          }
        }
      }

      if (!payment) {
        console.log(`⚠️ Payment not found for ${paystackRef}`);
        return res.status(200).json({ success: true });
      }

      if (payment.status === 'success') {
        return res.status(200).json({ success: true });
      }

      // Credit everyone
      payment.status = 'success';
      payment.paystackData = data;
      payment.paidAt = new Date();
      await payment.save();

      await Enrollment.findOneAndUpdate(
        { userId: payment.user._id, classId: payment.class._id },
        { paymentStatus: 'paid', paidAt: new Date(), accessType: 'paid' }
      );

      await Class.findByIdAndUpdate(payment.class._id, {
        $inc: { totalSales: 1, totalRevenue: payment.amount }
      });

      const instructorId = payment.instructor._id || payment.instructor;
      await User.findByIdAndUpdate(instructorId, {
        $inc: {
          earnings: payment.instructorEarning,
          totalRevenue: payment.instructorEarning,
          totalSales: 1
        }
      });

      console.log(`✅ Webhook processed: ${payment.reference}`);
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