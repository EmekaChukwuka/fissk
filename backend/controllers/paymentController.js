import Payment from '../models/Payment.js';
import Enrollment from '../models/Enrollment.js';
import Class from '../models/Class.js';
import User from '../models/User.js';
import paymentService from '../services/paymentService.js';
import emailService from '../services/emailService.js';

// ===== GENERATE UNIQUE REFERENCE (FISSK format) =====
function generateReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FISSK-${timestamp}-${random}`;
}

// ===== HELPER: Ensure reference is not already used in our DB =====
async function generateUniqueReference(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const ref = generateReference();
    const exists = await Payment.findOne({ reference: ref }).select('_id').lean();
    if (!exists) return ref;
  }
  // Extremely unlikely, but fall back to a definitely-unique value
  return `FISSK-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
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

    // Already paid? Short-circuit.
    const existingPaid = await Enrollment.findOne({
      userId, classId, paymentStatus: 'paid'
    });

    if (existingPaid) {
      return res.status(400).json({ success: false, message: 'You already have access' });
    }

    // A prior attempt may exist (pending or failed). Reuse the RECORD but
    // ALWAYS mint a fresh reference — Paystack rejects duplicates.
    const existingPayment = await Payment.findOne({
      user: userId, class: classId, status: { $in: ['pending', 'failed'] }
    }).sort({ createdAt: -1 });

    // ===== ALWAYS GENERATE A FRESH REFERENCE =====
    const finalReference = await generateUniqueReference();

    console.log('🔑 Generated fresh reference:', finalReference);
    if (existingPayment) {
      console.log('   Replacing stale reference on existing payment:', existingPayment.reference);
    }

    // Initialize with Paystack using the fresh reference
    const result = await paymentService.initializePayment(
      user.email,
      classData.price,
      {
        classId: classId,
        userId: userId,
        instructorId: classData.instructorId,
        className: classData.title,
        reference: finalReference
      }
    );

    if (!result.success) {
      // Paystack still complained about duplicate? Retry once with a new ref.
      if (result.code === 'duplicate_reference' || /duplicate/i.test(result.message || '')) {
        console.warn('⚠️ Duplicate reference from Paystack. Retrying with a new one...');
        const retryRef = await generateUniqueReference();
        const retry = await paymentService.initializePayment(
          user.email,
          classData.price,
          {
            classId,
            userId,
            instructorId: classData.instructorId,
            className: classData.title,
            reference: retryRef
          }
        );
        if (retry.success) {
          return await finalizePaymentRecord({
            res, existingPayment, retry,
            userId, classId, classData, user, usedReference: retryRef
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize payment after retry',
          error: retry.error
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
        error: result.error
      });
    }

    // Success path — persist the record and enrollment
    return await finalizePaymentRecord({
      res, existingPayment, retry: result,
      userId, classId, classData, user, usedReference: finalReference
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

// ===== HELPER: Persist payment + enrollment after a successful init =====
async function finalizePaymentRecord({
  res, existingPayment, retry, userId, classId, classData, user, usedReference
}) {
  const finalReference = retry.data.reference || usedReference;

  console.log('✅ Paystack accepted reference:', finalReference);

  let payment;

  if (existingPayment) {
    existingPayment.reference = finalReference;
    existingPayment.amount = classData.price;
    existingPayment.platformFee = classData.price * 0.3;
    existingPayment.instructorEarning = classData.price * 0.7;
    existingPayment.status = 'pending';
    existingPayment.metadata = {
      ...(existingPayment.metadata || {}),
      myReference: usedReference,
      className: classData.title
    };
    payment = await existingPayment.save();
  } else {
    payment = new Payment({
      user: userId,
      class: classId,
      instructor: classData.instructorId,
      amount: classData.price,
      reference: finalReference,
      status: 'pending',
      platformFee: classData.price * 0.3,
      instructorEarning: classData.price * 0.7,
      metadata: {
        myReference: usedReference,
        className: classData.title,
        studentEmail: user.email,
        studentName: `${user.firstName} ${user.lastName}`
      }
    });
    await payment.save();
  }

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

  return res.json({
    success: true,
    data: {
      authorizationUrl: retry.authorizationUrl,
      reference: finalReference
    }
  });
}

export const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Reference required' });
    }

    console.log('🔍 Verifying reference:', reference);

    let payment = await Payment.findOne({ reference })
      .populate('user')
      .populate('class')
      .populate('instructor');

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

      let payment = await Payment.findOne({ reference: paystackRef })
        .populate('user')
        .populate('class')
        .populate('instructor');

      if (!payment && data.metadata?.reference) {
        console.log('🔍 Trying metadata.reference...');
        payment = await Payment.findOne({ reference: data.metadata.reference })
          .populate('user')
          .populate('class')
          .populate('instructor');
      }

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