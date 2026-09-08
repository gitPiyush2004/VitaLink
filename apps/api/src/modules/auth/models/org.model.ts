/**
 * The `orgs` Mongoose schema.
 *
 * An organisation is the tenancy boundary: Socket.IO rooms, rate limits, webhook
 * subscriptions and carrier preferences are all scoped to one. Google sign-in
 * maps a verified email domain onto an org (PART 8), which is why
 * `email_domains` is indexed.
 */

import { model, Schema, type InferSchemaType } from 'mongoose';

const orgSchema = new Schema(
  {
    name: { type: String, required: true },
    /** Verified email domains whose users join this org automatically. */
    email_domains: { type: [String], default: [] },
    /**
     * Per-org overrides for the logistics weight profiles (spec 6.8). Empty means
     * "use the defaults in config/weights.ts".
     */
    weight_profile_overrides: { type: Schema.Types.Mixed, default: {} },
    /**
     * Declared, displayed carrier tie-break bonuses (spec 6.2). Stored per org
     * rather than in code so that changing it is an operational decision, and so
     * the recommendation explanation can name where it came from.
     */
    carrier_preference: { type: Schema.Types.Mixed, default: {} },
    is_active: { type: Boolean, default: true },
  },
  {
    collection: 'orgs',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: 'throw',
  },
);

// OAuth callback resolves an org from the user's email domain on every sign-in.
orgSchema.index({ email_domains: 1 });

export type OrgDocument = InferSchemaType<typeof orgSchema>;

export const OrgModel = model('Org', orgSchema);
