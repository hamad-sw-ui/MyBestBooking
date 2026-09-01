import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, rooms, reviews, bookings, roomAvailability } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { generateSlug } from "@/lib/utils";
import { stayNights } from "@/lib/booking-rules";
import { eq, and, ilike, or, desc, asc, sql, min, count, gte, lte, lt, gt, ne, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

const propertySchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  type: z.enum(["hotel", "apartment", "house", "villa", "hostel", "resort", "bnb", "guesthouse", "riad", "camping"]),
  description: z.string().optional(),
  starRating: z.number().min(0).max(5).optional(),
  addressLine: z.string().optional(),
  city: z.string().min(2, "La ville est requise"),
  state: z.string().optional(),
  country: z.string().length(2, "Le code pays doit être de 2 caractères"),
  postalCode: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  cancellationPolicy: z.enum(["free", "flexible", "moderate", "strict", "non_refundable"]).optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  mainImage: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const country = searchParams.get("country");
    const type = searchParams.get("type");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minRating = searchParams.get("minRating");
    const search = searchParams.get("search");

    // T-121 (F1) — borner/valider les paramètres numériques de pagination et
    // de filtre. Avant, un `offset` négatif faisait planter Postgres
    // (« OFFSET must not be negative » → 500) et un `minRating` non
    // numérique (« abc ») faisait échouer le cast SQL (→ 500). On normalise
    // ici pour répondre 400 proprement ou retomber sur une valeur sûre.
    const parsePositiveInt = (raw: string | null, fallback: number, max: number): number => {
      if (raw === null) return fallback;
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) return fallback;
      return Math.min(n, max);
    };
    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
    const offsetRaw = searchParams.get("offset");
    if (offsetRaw !== null) {
      const o = Number.parseInt(offsetRaw, 10);
      if (!Number.isFinite(o) || o < 0) {
        return NextResponse.json(
          { error: await apiError("Le paramètre offset doit être un entier positif ou nul") },
          { status: 400 },
        );
      }
    }
    const offset = Math.max(0, Number.parseInt(offsetRaw || "0", 10) || 0);
    if (minRating !== null) {
      const r = Number(minRating);
      if (!Number.isFinite(r) || r < 0 || r > 10) {
        return NextResponse.json(
          { error: await apiError("Le paramètre minRating doit être un nombre entre 0 et 10") },
          { status: 400 },
        );
      }
    }
    const minRatingNum = minRating !== null ? Number(minRating) : null;
    // Prix : un filtre de prix non numérique est rejeté (sinon parseFloat →
    // NaN produisait un filtrage incohérent).
    for (const [name, val] of [["minPrice", minPrice], ["maxPrice", maxPrice]] as const) {
      if (val !== null) {
        const p = Number(val);
        if (!Number.isFinite(p) || p < 0) {
          return NextResponse.json(
            { error: `Le paramètre ${name} doit être un nombre positif` },
            { status: 400 },
          );
        }
      }
    }
    // T-026 : nouveaux filtres
    const amenitiesParam = searchParams.get("amenities"); // csv
    const guests = searchParams.get("guests");
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const sort = searchParams.get("sort") || "rating"; // rating | price_asc | price_desc | popularity
    const near = searchParams.get("near"); // "lat,lng,km"

    // T-119 (A2) — validation des paramètres de recherche.
    // Un paramètre `guests` explicite mais invalide doit produire une 400
    // claire plutôt que d'être silencieusement ignoré (ce qui renvoyait
    // alors TOUS les hébergements, dont aucun ne convenait).
    let guestsNum: number | null = null;
    if (guests !== null) {
      const parsed = Number(guests);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: await apiError("Le paramètre guests doit être un entier positif") },
          { status: 400 },
        );
      }
      guestsNum = parsed;
    }
    // Dates incohérentes (départ <= arrivée) alors qu'une recherche par
    // dates est demandée → aucun hébergement ne peut correspondre. On le
    // note pour renvoyer une liste vide au lieu d'ignorer le filtre.
    const stayDatesValid =
      checkIn && checkOut
        ? /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
          /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
          checkOut > checkIn
        : true;

    let query = db.select().from(properties).where(eq(properties.status, "active"));

    const conditions = [eq(properties.status, "active")];

    if (city) {
      conditions.push(ilike(properties.city, `%${city}%`));
    }

    if (country) {
      conditions.push(eq(properties.country, country));
    }

    if (type) {
      conditions.push(eq(properties.type, type));
    }

    if (minRatingNum !== null) {
      conditions.push(sql`${properties.averageRating} >= ${minRatingNum}`);
    }

    if (search) {
      conditions.push(
        or(
          ilike(properties.name, `%${search}%`),
          ilike(properties.city, `%${search}%`),
          ilike(properties.description, `%${search}%`)
        )!
      );
    }

    // T-026 : filtre amenities — chaque équipement demandé doit être
    // présent dans le tableau JSONB `properties.amenities`.
    if (amenitiesParam) {
      const wanted = amenitiesParam.split(",").map((a) => a.trim()).filter(Boolean);
      for (const a of wanted) {
        conditions.push(sql`${properties.amenities} @> ${JSON.stringify([a])}::jsonb`);
      }
    }

    // T-026 : conditions supplémentaires sur les rooms (guests).
    // On filtre les rooms compatibles côté JOIN pour éviter d'exclure
    // une property qui a d'autres rooms plus petites.
    const roomJoinConds = [eq(rooms.propertyId, properties.id), eq(rooms.isActive, true)];
    if (guestsNum !== null) {
      roomJoinConds.push(gte(rooms.maxOccupancy, guestsNum));
    }

    // T-026 : ordre configurable.
    let orderClause;
    switch (sort) {
      case "price_asc":
        orderClause = asc(sql`MIN(${rooms.basePrice})`);
        break;
      case "price_desc":
        orderClause = desc(sql`MIN(${rooms.basePrice})`);
        break;
      case "popularity":
        orderClause = desc(properties.totalReviews);
        break;
      case "rating":
      default:
        orderClause = desc(properties.averageRating);
    }

    // ── T-004 (BUG-004) : remplace le N+1 par un unique LEFT JOIN
    //    + agrégation SQL. Le filtre price est appliqué en JS après
    //    agrégation, ainsi que la disponibilité et la distance. Pour que le
    //    `total` (T-121/F2) et la pagination soient fidèles à TOUS les
    //    filtres (pas seulement ceux de la requête SQL), on récupère un
    //    jeu large borné, on applique les filtres JS, puis on pagine en JS.
    const rows = await db
      .select({
        property: properties,
        minPrice: min(rooms.basePrice),
        // T-121 (F3) — devise de la chambre la moins chère (toutes les
        // chambres d'une propriété partagent la même devise en pratique).
        currency: min(rooms.currency),
        roomCount: count(rooms.id),
      })
      .from(properties)
      .leftJoin(rooms, and(...roomJoinConds))
      .where(and(...conditions))
      .groupBy(properties.id)
      .orderBy(orderClause)
      .limit(1000);

    let filteredResults = rows.map((r) => ({
      ...r.property,
      minPrice: r.minPrice !== null ? parseFloat(r.minPrice as string) : null,
      currency: (r.currency as string | null) ?? "EUR",
      roomCount: Number(r.roomCount),
}));

    // T-119 (A1) — corrige le bug du LEFT JOIN : quand un filtre de
    // capacité (guests) ou de prix est demandé, une propriété dont
    // AUCUNE chambre ne satisfait la condition ressort avec roomCount=0 /
    // minPrice=null à cause du LEFT JOIN. On l'explicite : elle n'est pas
    // bookable pour ces critères → on la retire des résultats.
    if (guestsNum !== null || minPrice !== null) {
      filteredResults = filteredResults.filter((p) => p.roomCount > 0);
    }
    // T-119 (A2) — dates demandées mais incohérentes/invalides : aucune
    // disponibilité possible → liste vide (au lieu d'ignorer le filtre).
    if (!stayDatesValid) {
      filteredResults = [];
    }

    // T-119 (A1) — corrige le bug du LEFT JOIN : quand un filtre de
    // capacité (guests) ou de prix est demandé, une propriété dont
    // AUCUNE chambre ne satisfait la condition ressort avec roomCount=0 /
    // minPrice=null à cause du LEFT JOIN. On l'explicite : elle n'est pas
    // bookable pour ces critères → on la retire des résultats.
    if (guestsNum !== null || minPrice !== null) {
      filteredResults = filteredResults.filter((p) => p.roomCount > 0);
    }
    // T-119 (A2) — dates demandées mais incohérentes/invalides : aucune
    // disponibilité possible → liste vide (au lieu d'ignorer le filtre).
    if (!stayDatesValid) {
      filteredResults = [];
    }

    // Filter by price if needed (post-agrégation, borne côté JS car
    // Drizzle 0.45 n'expose pas `having` sur select simple ; tolerable
    // pour l'ordre de grandeur d'aujourd'hui, à optimiser si le trafic
    // impose le HAVING SQL).
    if (minPrice) {
      filteredResults = filteredResults.filter((p) => p.minPrice !== null && p.minPrice >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filteredResults = filteredResults.filter((p) => p.minPrice !== null && p.minPrice <= parseFloat(maxPrice));
    }

    // Disponibilité évaluée nuit par nuit, avec le même modèle que la
    // création de booking : override daily, stop-sell et minimum à l'arrivée.
    if (checkIn && checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkOut > checkIn) {
      const nights = stayNights(checkIn, checkOut);
      const propIds = filteredResults.map((p) => p.id);
      if (propIds.length > 0) {
        const roomsInfo = await db
          .select({ id: rooms.id, propertyId: rooms.propertyId, quantity: rooms.quantity })
          .from(rooms)
          .where(and(inArray(rooms.propertyId, propIds), eq(rooms.isActive, true)));
        const roomIds = roomsInfo.map((room) => room.id);
        const overlapping = roomIds.length ? await db
          .select({ roomId: bookings.roomId, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
          .from(bookings)
          .where(and(inArray(bookings.roomId, roomIds), ne(bookings.status, "cancelled"), lt(bookings.checkIn, checkOut), gt(bookings.checkOut, checkIn))) : [];
        const dailyRules = roomIds.length ? await db
          .select({ roomId: roomAvailability.roomId, date: roomAvailability.date, availableCount: roomAvailability.availableCount, stopSell: roomAvailability.stopSell, minStay: roomAvailability.minStay })
          .from(roomAvailability)
          .where(and(inArray(roomAvailability.roomId, roomIds), gte(roomAvailability.date, checkIn), lt(roomAvailability.date, checkOut))) : [];
        const availablePropIds = new Set<string>();
        for (const room of roomsInfo) {
          const rules = new Map(dailyRules.filter((rule) => rule.roomId === room.id).map((rule) => [String(rule.date).slice(0, 10), rule]));
          const arrival = rules.get(checkIn);
          if ((arrival?.minStay ?? 1) > nights.length) continue;
          const canBook = nights.every((night) => {
            const rule = rules.get(night);
            if (rule?.stopSell) return false;
            const capacity = Math.min(rule?.availableCount ?? room.quantity ?? 1, room.quantity ?? 1);
            const occupied = overlapping.filter((booking) => booking.roomId === room.id && String(booking.checkIn).slice(0, 10) <= night && String(booking.checkOut).slice(0, 10) > night).length;
            return capacity > occupied;
          });
          if (canBook) availablePropIds.add(room.propertyId);
        }
        filteredResults = filteredResults.filter((property) => availablePropIds.has(property.id));
      }
    }

    // T-026 : filtre "near" — distance haversine grossière en km,
    // filtre uniquement les properties avec lat/lng renseignés.
    if (near) {
      const parts = near.split(",").map((s) => parseFloat(s.trim()));
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        const [lat, lng, km] = parts;
        filteredResults = filteredResults.filter((p) => {
          if (!p.latitude || !p.longitude) return false;
          const pLat = parseFloat(p.latitude);
          const pLng = parseFloat(p.longitude);
          const R = 6371;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(pLat - lat);
          const dLng = toRad(pLng - lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(pLat)) * Math.sin(dLng / 2) ** 2;
          const d = 2 * R * Math.asin(Math.sqrt(a));
          return d <= km;
        });
      }
    }

    // T-121 (F2) — `total` compte l'ensemble filtré (avant pagination), pour
    // permettre à un client de construire une pagination. La pagination est
    // appliquée en JS, APRÈS tous les filtres (prix, disponibilité, distance,
    // capacité) afin que `total` et la tranche renvoyée soient cohérents.
    const total = filteredResults.length;
    const paginated = filteredResults.slice(offset, offset + limit);

    // BUG-021 (Session 11 paranoid) : filtrer les champs métier
    // sensibles (commissionRate, validatedBy, hostId interne) pour
    // les listings publics. Un admin peut lire tous les champs via
    // GET /api/properties/[id] (route détail qui ne filtre pas).
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser?.role === "admin";
    const sanitized = isAdmin
      ? paginated
      : paginated.map((p) => {
          const {
            commissionRate: _cr,
            validatedBy: _vb,
            hostId: _hi,
            ...safe
          } = p as typeof p & { commissionRate?: unknown; validatedBy?: unknown; hostId?: unknown };
          return safe;
        });
    // T-121 (F2) — métadonnées de pagination additifs (aucun appelant
    // existant cassé). La page /recherche garde son propre SQL/SSR.
    return NextResponse.json({
      properties: sanitized,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "host" && user.role !== "admin")) {
      return NextResponse.json(
        { error: await apiError("Non autorisé") },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = propertySchema.parse(body);

    // Generate unique slug
    let slug = generateSlug(data.name);
    const existingSlug = await db.select().from(properties).where(eq(properties.slug, slug));
    if (existingSlug.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const [newProperty] = await db
      .insert(properties)
      .values({
        ...data,
        slug,
        hostId: user.id,
        status: user.role === "admin" ? "active" : "pending",
        amenities: data.amenities || [],
        images: data.images || [],
      })
      .returning();

    return NextResponse.json({ property: newProperty }, { status: 201 });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: await apiError(frenchZodMessage(error)) },
        { status: 400 }
      );
    }
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}
