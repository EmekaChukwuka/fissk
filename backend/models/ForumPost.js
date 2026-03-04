import mongoose from "mongoose";

const ReplySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: Number, default: 0 },
  isBestAnswer: { type: Boolean, default: false }
}, { _id: false });

const ForumPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumCategory', required: true },
  views: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  solved: { type: Boolean, default: false },
  tags: [String],
  replies: [ReplySchema]
}, { timestamps: true });

ForumPostSchema.index({ userId: 1 });
ForumPostSchema.index({ categoryId: 1 });
ForumPostSchema.index({ createdAt: -1 });
ForumPostSchema.index({ isPinned: -1, createdAt: -1 });

export default mongoose.model("ForumPost", ForumPostSchema);