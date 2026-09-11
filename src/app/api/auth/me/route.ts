import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { parseUserNotificationPrefs } from "@/lib/notification-prefs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: await apiError("Non authentifié") },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      language: user.language,
      currency: user.currency,
      role: user.role,
      approvalStatus: user.role === "host" ? user.approvalStatus : null,
      bestrewardsLevel: user.bestrewardsLevel,
      bestrewardsBookingsCount: user.bestrewardsBookingsCount,
      walletBalance: user.walletBalance,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      timezone: user.timezone,
      priceAlertEnabled: user.priceAlertEnabled,
      // T-261 (audit n°6, B9) : préférences par catégorie (null = héritage
      // du réglage global) — l'écran de `/mon-compte` les édite.
      notificationPrefs: parseUserNotificationPrefs(user.notificationPrefs),
      avatarUrl: user.avatarUrl,
    },
  });
}
