import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, properties, rooms, bookings, reviews, promotions, wishlists } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { generateSlug, generateBookingReference } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api-error";

/**
 * Vérifie qu'une requête POST /api/seed est autorisée.
 * — En dev/test : toujours autorisée.
 * — En prod : exige l'en-tête `x-seed-token` égal à `SEED_TOKEN` (env var)
 *   avec comparaison en temps constant. Retourne `null` si autorisé, une
 *   Response 404 sinon (on cache l'existence de la route).
 * Voir ADR-004, BUG-002.
 */
function checkSeedAuthorization(request: NextRequest): NextResponse | null {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return null;

  const expected = process.env.SEED_TOKEN;
  const received = request.headers.get("x-seed-token");
  if (!expected || !received || expected.length !== received.length) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const ok = timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
  return ok ? null : new NextResponse("Not Found", { status: 404 });
}

const DEMO_PROPERTIES = [
  {
    name: "Hôtel Le Magnifique",
    type: "hotel",
    description: "Un hôtel 4 étoiles au cœur de Paris, à quelques pas du Louvre. Chambres élégantes, restaurant gastronomique et spa de luxe.",
    starRating: 4,
    city: "Paris",
    country: "FR",
    addressLine: "15 Rue de Rivoli",
    postalCode: "75001",
    latitude: "48.8606",
    longitude: "2.3376",
    amenities: ["wifi", "spa", "restaurant", "bar", "gym", "parking", "room_service", "concierge"],
    mainImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    images: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
    ],
  },
  {
    name: "Riad Jardin Secret",
    type: "riad",
    description: "Un riad traditionnel au cœur de la médina de Marrakech. Architecture authentique, patio fleuri et terrasse panoramique.",
    starRating: 4,
    city: "Marrakech",
    country: "MA",
    addressLine: "Derb Moulay Abdel Kader",
    postalCode: "40000",
    latitude: "31.6295",
    longitude: "-7.9811",
    amenities: ["wifi", "pool", "restaurant", "spa", "terrace", "air_conditioning"],
    mainImage: "https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?w=800",
    images: [
      "https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?w=800",
      "https://images.unsplash.com/photo-1539437829697-1b4ed5aebd19?w=800",
    ],
  },
  {
    name: "Villa Azure Côte d'Azur",
    type: "villa",
    description: "Magnifique villa avec vue mer panoramique sur la Côte d'Azur. Piscine à débordement, jardins méditerranéens et accès privé à la plage.",
    starRating: 5,
    city: "Nice",
    country: "FR",
    addressLine: "Chemin des Collines",
    postalCode: "06000",
    latitude: "43.7102",
    longitude: "7.2620",
    amenities: ["wifi", "pool", "beach_access", "parking", "garden", "bbq", "sea_view"],
    mainImage: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    ],
  },
  {
    name: "Appartement Montmartre",
    type: "apartment",
    description: "Charmant appartement parisien au pied du Sacré-Cœur. Vue sur les toits de Paris, décoration vintage et emplacement idéal.",
    starRating: 3,
    city: "Paris",
    country: "FR",
    addressLine: "12 Rue Lepic",
    postalCode: "75018",
    latitude: "48.8867",
    longitude: "2.3431",
    amenities: ["wifi", "kitchen", "washing_machine", "city_view", "balcony"],
    mainImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    ],
  },
  {
    name: "Dar El Medina",
    type: "guesthouse",
    description: "Maison d'hôtes authentique dans la médina de Tunis. Architecture arabo-andalouse, cuisine traditionnelle et hospitalité tunisienne.",
    starRating: 3,
    city: "Tunis",
    country: "TN",
    addressLine: "Rue de la Kasbah",
    postalCode: "1000",
    latitude: "36.7992",
    longitude: "10.1719",
    amenities: ["wifi", "restaurant", "terrace", "air_conditioning", "traditional_hammam"],
    mainImage: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
    images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
    ],
  },
  {
    name: "Resort Les Dunes",
    type: "resort",
    description: "Resort all-inclusive en bord de mer à Djerba. Plage privée, sports nautiques, animations et gastronomie internationale.",
    starRating: 5,
    city: "Djerba",
    country: "TN",
    addressLine: "Zone Touristique",
    postalCode: "4180",
    latitude: "33.8076",
    longitude: "10.9445",
    amenities: ["wifi", "pool", "beach", "spa", "restaurant", "bar", "gym", "kids_club", "water_sports"],
    mainImage: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
    images: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
    ],
  },
  {
    name: "Hôtel Barcelona Center",
    type: "hotel",
    description: "Hôtel moderne au cœur de Barcelone, à deux pas de la Rambla. Design contemporain, rooftop avec piscine et vue sur la ville.",
    starRating: 4,
    city: "Barcelone",
    country: "ES",
    addressLine: "Carrer de Pelai, 28",
    postalCode: "08001",
    latitude: "41.3851",
    longitude: "2.1734",
    amenities: ["wifi", "pool", "restaurant", "bar", "gym", "rooftop", "city_view"],
    mainImage: "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800",
    images: [
      "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800",
    ],
  },
  {
    name: "B&B Toscana",
    type: "bnb",
    description: "Charmant bed & breakfast dans les collines toscanes. Vue sur les vignobles, petit-déjeuner maison et atmosphère familiale.",
    starRating: 3,
    city: "Florence",
    country: "IT",
    addressLine: "Via delle Colline, 42",
    postalCode: "50125",
    latitude: "43.7696",
    longitude: "11.2558",
    amenities: ["wifi", "breakfast", "garden", "parking", "countryside_view"],
    mainImage: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
    images: [
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
    ],
  },
];

const ROOM_TYPES = [
  { name: "Chambre Standard", roomType: "double", maxOccupancy: 2, maxAdults: 2, basePrice: 89 },
  { name: "Chambre Supérieure", roomType: "double", maxOccupancy: 2, maxAdults: 2, basePrice: 129 },
  { name: "Suite Junior", roomType: "suite", maxOccupancy: 3, maxAdults: 2, maxChildren: 1, basePrice: 189 },
  { name: "Chambre Familiale", roomType: "family", maxOccupancy: 4, maxAdults: 2, maxChildren: 2, basePrice: 159 },
  { name: "Suite Deluxe", roomType: "suite", maxOccupancy: 2, maxAdults: 2, basePrice: 289 },
];

const REVIEW_COMMENTS = [
  { positive: "Séjour parfait ! L'emplacement est idéal et le personnel très accueillant.", negative: "La connexion WiFi pourrait être plus rapide.", travelerType: "couple" },
  { positive: "Chambre spacieuse et propre. Le petit-déjeuner était excellent.", negative: "Un peu bruyant le soir.", travelerType: "business" },
  { positive: "Vue magnifique et service impeccable. Nous reviendrons !", negative: null, travelerType: "family" },
  { positive: "Excellent rapport qualité-prix. Très bien situé.", negative: "Parking un peu cher.", travelerType: "solo" },
  { positive: "Décoration superbe et ambiance très agréable.", negative: "La climatisation était un peu bruyante.", travelerType: "couple" },
];

export async function POST(request: NextRequest) {
  const forbidden = checkSeedAuthorization(request);
  if (forbidden) return forbidden;

  try {
    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      return NextResponse.json({ message: await apiError("Données déjà présentes") });
    }

    // Create admin user
    const adminPassword = await hashPassword("Admin123!");
    const [adminUser] = await db.insert(users).values({
      email: "admin@mybestbooking.com",
      passwordHash: adminPassword,
      firstName: "Admin",
      lastName: "MBB",
      role: "admin",
      emailVerified: true,
      bestrewardsLevel: 3,
    }).returning();

    // Create host user
    const hostPassword = await hashPassword("Host123!");
    const [hostUser] = await db.insert(users).values({
      email: "host@mybestbooking.com",
      passwordHash: hostPassword,
      firstName: "Jean",
      lastName: "Dupont",
      role: "host",
      emailVerified: true,
      phone: "+33612345678",
      country: "FR",
    }).returning();

    // Create customer user
    const customerPassword = await hashPassword("Customer123!");
    const [customerUser] = await db.insert(users).values({
      email: "customer@mybestbooking.com",
      passwordHash: customerPassword,
      firstName: "Marie",
      lastName: "Martin",
      role: "customer",
      emailVerified: true,
      bestrewardsLevel: 2,
      bestrewardsBookingsCount: 7,
      walletBalance: "25.00",
    }).returning();

    // Create more customers for reviews
    const reviewers = [];
    const reviewerNames = [
      { firstName: "Pierre", lastName: "Bernard" },
      { firstName: "Sophie", lastName: "Petit" },
      { firstName: "Lucas", lastName: "Robert" },
      { firstName: "Emma", lastName: "Richard" },
      { firstName: "Hugo", lastName: "Durand" },
    ];

    for (const name of reviewerNames) {
      const password = await hashPassword("Customer123!");
      const [reviewer] = await db.insert(users).values({
        email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@email.com`,
        passwordHash: password,
        firstName: name.firstName,
        lastName: name.lastName,
        role: "customer",
        emailVerified: true,
        bestrewardsLevel: Math.floor(Math.random() * 3) + 1,
      }).returning();
      reviewers.push(reviewer);
    }

    // Create properties
    const createdProperties = [];
    for (const prop of DEMO_PROPERTIES) {
      const slug = generateSlug(prop.name);
      const [property] = await db.insert(properties).values({
        ...prop,
        slug,
        hostId: hostUser.id,
        status: "active",
        isBestrewards: Math.random() > 0.5,
        isPreferred: Math.random() > 0.7,
        validatedAt: new Date(),
        validatedBy: adminUser.id,
      }).returning();
      createdProperties.push(property);

      // Create rooms for each property
      const numRooms = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numRooms; i++) {
        const roomType = ROOM_TYPES[i % ROOM_TYPES.length];
        const priceMultiplier = prop.starRating ? prop.starRating / 3 : 1;
        await db.insert(rooms).values({
          propertyId: property.id,
          name: roomType.name,
          roomType: roomType.roomType,
          maxOccupancy: roomType.maxOccupancy,
          maxAdults: roomType.maxAdults,
          maxChildren: roomType.maxChildren || 0,
          basePrice: (roomType.basePrice * priceMultiplier).toFixed(2),
          quantity: Math.floor(Math.random() * 5) + 2,
          sizeSqm: (20 + Math.random() * 30).toFixed(2),
          amenities: ["wifi", "tv", "air_conditioning", "minibar"],
          bedConfiguration: [{ type: roomType.roomType === "twin" ? "single" : "queen", count: roomType.roomType === "twin" ? 2 : 1 }],
        });
      }
    }

    // Create bookings and reviews
    const today = new Date();
    for (let i = 0; i < createdProperties.length; i++) {
      const property = createdProperties[i];
      const propertyRooms = await db.select().from(rooms).where(eq(rooms.propertyId, property.id));
      
      if (propertyRooms.length === 0) continue;

      // Create 3-5 bookings per property
      const numBookings = Math.floor(Math.random() * 3) + 3;
      let totalRating = 0;
      let reviewCount = 0;

      for (let j = 0; j < numBookings; j++) {
        const room = propertyRooms[j % propertyRooms.length];
        const reviewer = reviewers[j % reviewers.length];
        const checkIn = new Date(today);
        checkIn.setDate(checkIn.getDate() - 30 - (j * 10));
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 4) + 2);
        const numNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const subtotal = parseFloat(room.basePrice) * numNights;
        const taxes = subtotal * 0.1;
        const total = subtotal + taxes;
        const commissionRate = 15;
        const commissionAmount = total * (commissionRate / 100);

        const [booking] = await db.insert(bookings).values({
          bookingReference: generateBookingReference(),
          userId: reviewer.id,
          propertyId: property.id,
          roomId: room.id,
          status: "completed",
          checkIn: checkIn.toISOString().split("T")[0],
          checkOut: checkOut.toISOString().split("T")[0],
          numNights,
          numAdults: 2,
          numChildren: 0,
          guestFirstName: reviewer.firstName,
          guestLastName: reviewer.lastName,
          guestEmail: reviewer.email,
          guestCountry: "FR",
          subtotal: subtotal.toFixed(2),
          taxes: taxes.toFixed(2),
          total: total.toFixed(2),
          currency: "EUR",
          paymentStatus: "paid",
          paymentMethod: "card",
          commissionRate: commissionRate.toFixed(2),
          commissionAmount: commissionAmount.toFixed(2),
          netToHost: (total - commissionAmount).toFixed(2),
        }).returning();

        // Create review for most bookings
        if (j < numBookings - 1) {
          const reviewData = REVIEW_COMMENTS[j % REVIEW_COMMENTS.length];
          const overallRating = 7 + Math.random() * 3;
          totalRating += overallRating;
          reviewCount++;

          await db.insert(reviews).values({
            bookingId: booking.id,
            userId: reviewer.id,
            propertyId: property.id,
            overallRating: overallRating.toFixed(1),
            cleanlinessRating: Math.floor(7 + Math.random() * 3),
            comfortRating: Math.floor(7 + Math.random() * 3),
            locationRating: Math.floor(8 + Math.random() * 2),
            facilitiesRating: Math.floor(7 + Math.random() * 3),
            staffRating: Math.floor(8 + Math.random() * 2),
            valueRating: Math.floor(7 + Math.random() * 3),
            positiveComment: reviewData.positive,
            negativeComment: reviewData.negative,
            travelerType: reviewData.travelerType,
            status: "approved",
            isVerified: true,
          });
        }
      }

      // Update property rating
      if (reviewCount > 0) {
        await db.update(properties).set({
          averageRating: (totalRating / reviewCount).toFixed(1),
          totalReviews: reviewCount,
        }).where(eq(properties.id, property.id));
      }
    }

    // Create upcoming booking for demo customer
    const futureProperty = createdProperties[0];
    const futureRooms = await db.select().from(rooms).where(eq(rooms.propertyId, futureProperty.id));
    if (futureRooms.length > 0) {
      const futureRoom = futureRooms[0];
      const checkIn = new Date(today);
      checkIn.setDate(checkIn.getDate() + 14);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);
      const numNights = 3;
      const subtotal = parseFloat(futureRoom.basePrice) * numNights;
      const taxes = subtotal * 0.1;
      const total = subtotal + taxes;

      await db.insert(bookings).values({
        bookingReference: generateBookingReference(),
        userId: customerUser.id,
        propertyId: futureProperty.id,
        roomId: futureRoom.id,
        status: "confirmed",
        checkIn: checkIn.toISOString().split("T")[0],
        checkOut: checkOut.toISOString().split("T")[0],
        numNights,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: customerUser.firstName,
        guestLastName: customerUser.lastName,
        guestEmail: customerUser.email,
        guestCountry: "FR",
        subtotal: subtotal.toFixed(2),
        taxes: taxes.toFixed(2),
        total: total.toFixed(2),
        currency: "EUR",
        paymentStatus: "paid",
        paymentMethod: "card",
        commissionRate: "15.00",
        commissionAmount: (total * 0.15).toFixed(2),
        netToHost: (total * 0.85).toFixed(2),
      });
    }

    // Create promotions
    const now = new Date();
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    await db.insert(promotions).values([
      {
        code: "BIENVENUE10",
        name: "Bienvenue — 10% de réduction",
        type: "percentage",
        value: "10",
        minBookingAmount: "50",
        maxDiscount: "100",
        validFrom: oneMonthAgo,
        validUntil: threeMonthsLater,
        maxUses: 1000,
        currentUses: 145,
        isActive: true,
      },
      {
        code: "ETE2025",
        name: "Offre d'été 2025 — 15%",
        type: "percentage",
        value: "15",
        minBookingAmount: "100",
        maxDiscount: "200",
        validFrom: now,
        validUntil: threeMonthsLater,
        maxUses: 500,
        currentUses: 67,
        isActive: true,
      },
      {
        code: "LASTMINUTE",
        name: "Dernière minute — 20€ de réduction",
        type: "fixed_amount",
        value: "20",
        minBookingAmount: "80",
        validFrom: now,
        validUntil: threeMonthsLater,
        maxUses: 200,
        currentUses: 23,
        isActive: true,
      },
      {
        code: "AMBASSADOR",
        name: "Offre Ambassador — 25%",
        type: "percentage",
        value: "25",
        minBookingAmount: "150",
        maxDiscount: "500",
        validFrom: now,
        validUntil: threeMonthsLater,
        maxUses: 100,
        currentUses: 8,
        isActive: true,
      },
    ]);

    // Create wishlist for demo customer
    await db.insert(wishlists).values({
      userId: customerUser.id,
      name: "Vacances été 2025",
      isPublic: false,
    });

    return NextResponse.json({
      message: await apiError("Données de démonstration créées avec succès"),
      users: {
        admin: { email: "admin@mybestbooking.com", password: "Admin123!" },
        host: { email: "host@mybestbooking.com", password: "Host123!" },
        customer: { email: "customer@mybestbooking.com", password: "Customer123!" },
      },
      properties: createdProperties.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: await apiError("Erreur lors de la création des données"), details: String(error) },
      { status: 500 }
    );
  }
}


