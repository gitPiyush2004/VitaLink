/**
 * The `users` Mongoose schema.
 *
 * Conventions this file demonstrates, and every other model file follows
 * (PART 3A.7):
 *
 *  - one schema per file, explicit `collection` name, plural snake_case
 *  - `timestamps` mapped to snake_case, because the database speaks snake_case
 *    and TypeScript speaks camelCase; the translation happens in the repository
 *  - indexes declared here, never created ad hoc in application code, so the
 *    schema is the single source of truth for what is indexed
 *  - `select: false` on the password hash, so it cannot be returned by accident
 *  - no business logic in hooks: the pre-save hook normalises the email and
 *    nothing else. Anything with a decision in it belongs in the service.
 */

import { model, Schema, type InferSchemaType } from 'mongoose';

import { ROLES } from '@vitalink/contracts';

const MAX_EMAIL_LENGTH = 320;

const userSchema = new Schema(
  {
    // Note there is no `unique: true` here. Uniqueness is declared once, in the
    // `schema.index()` call below, because this project's convention is that
    // indexes are declared explicitly in one place. Setting both produces a
    // duplicate-index warning at boot and two sources of truth.
    email: { type: String, required: true, maxlength: MAX_EMAIL_LENGTH },
    /**
     * bcrypt hash. Never selected by default, so a careless `findOne` cannot leak
     * it into a response body.
     */
    password_hash: { type: String, required: true, select: false },
    display_name: { type: String, required: true },
    org_id: { type: String, required: true },
    role: { type: String, required: true, enum: ROLES },
    /** Set for accounts created through Google OIDC; null for password accounts. */
    oauth_subject: { type: String, default: null },
    last_login_at: { type: Date, default: null },
    is_disabled: { type: Boolean, default: false },
    /**
     * Declared even though the `timestamps` option below fills them in, so that
     * every field actually stored is visible in the schema.
     */
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  {
    collection: 'users',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    // Set globally in shared/db/mongo.ts, restated here so a reader of this file
    // knows an unexpected field is an error rather than silently dropped.
    strict: 'throw',
  },
);

// Login looks a user up by email on every attempt, and email must be unique.
userSchema.index({ email: 1 }, { unique: true });

// The admin screen lists members of one org, newest first. Compound index field
// order matters: equality field first, then the sort field. ADR-0005.
userSchema.index({ org_id: 1, created_at: -1 });

// Sparse because most users have no OAuth subject, and a non-sparse unique index
// would reject the second null.
userSchema.index({ oauth_subject: 1 }, { unique: true, sparse: true });

userSchema.pre('save', function normaliseEmail(next) {
  if (this.isModified('email')) {
    this.email = this.email.trim().toLowerCase();
  }
  next();
});

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = model('User', userSchema);
