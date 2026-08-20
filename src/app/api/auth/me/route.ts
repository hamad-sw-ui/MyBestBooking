import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Non authentifié" },
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
      bestrewardsLevel: user.bestrewardsLevel,
      bestrewardsBookingsCount: user.bestrewardsBookingsCount,
      walletBalance: user.walletBalance,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
}
