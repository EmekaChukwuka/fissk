import mongoose from "mongoose";

const ForumCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  slug: { type: String, unique: true, required: true },
  icon: { type: String, default: '?' },
  color: { type: String, default: '#8B5FBF' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

ForumCategorySchema.index({ isActive: 1 });
ForumCategorySchema.index({ sortOrder: 1 });

export default mongoose.model("ForumCategory", ForumCategorySchema);