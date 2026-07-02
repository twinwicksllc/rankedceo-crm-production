// =============================================================================
// WaaS JSON-LD Utility (v2.0)
// Builds a deeply populated LocalBusiness + Service schema graph.
// =============================================================================

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface OperatingHoursInput {
  dayOfWeek: DayOfWeek | DayOfWeek[];
  opens: string;
  closes: string;
  validFrom?: string;
  validThrough?: string;
}

export interface GeoCoordinatesInput {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface PostalAddressInput {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
}

export interface LicenseInput {
  licenseNumber: string;
  authorityName?: string;
  authorityUrl?: string;
  issuingRegion?: string;
  validThrough?: string;
}

export interface OfferInput {
  name?: string;
  description?: string;
  price?: number | string;
  priceCurrency?: string;
  availability?: string;
  url?: string;
}

export interface ServiceInput {
  id?: string;
  name: string;
  description?: string;
  serviceType?: string;
  category?: string;
  areaServed?: string[];
  termsOfService?: string;
  audienceType?: string;
  hoursAvailable?: OperatingHoursInput[];
  offers?: OfferInput[];
}

export interface LocalBusinessSchemaInput {
  baseId?: string;
  canonicalUrl: string;
  businessType?: string;
  name: string;
  alternateName?: string;
  description?: string;
  slogan?: string;
  image?: string[];
  logo?: string;
  telephone?: string;
  email?: string;
  priceRange?: string;
  currenciesAccepted?: string[];
  paymentAccepted?: string[];
  sameAs?: string[];
  foundingDate?: string;
  address: PostalAddressInput;
  geo?: GeoCoordinatesInput;
  licenses?: LicenseInput[];
  operatingHours?: OperatingHoursInput[];
  serviceAreas?: string[];
  services: ServiceInput[];
}

type JsonLdObject = Record<string, unknown>;

const SCHEMA_CONTEXT = "https://schema.org";

function normalizeBaseId(input: string): string {
  return input.replace(/\/$/, "");
}

function normalizeServiceId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toSchemaDay(day: DayOfWeek): string {
  return `https://schema.org/${day}`;
}

function toOpeningHoursSpecification(
  hours: OperatingHoursInput[],
): JsonLdObject[] {
  return hours
    .filter((h) => h && h.opens && h.closes)
    .map((h) => {
      const dayList = Array.isArray(h.dayOfWeek) ? h.dayOfWeek : [h.dayOfWeek];
      const entry: JsonLdObject = {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: dayList.map(toSchemaDay),
        opens: h.opens,
        closes: h.closes,
      };

      if (h.validFrom) entry.validFrom = h.validFrom;
      if (h.validThrough) entry.validThrough = h.validThrough;

      return entry;
    });
}

function toAreaServedPlaces(
  areaServed: string[] | undefined,
): JsonLdObject[] | undefined {
  if (!areaServed?.length) return undefined;

  return areaServed
    .map((area) => area.trim())
    .filter(Boolean)
    .map((name) => ({
      "@type": "Place",
      name,
    }));
}

function toIdentifierProperties(
  licenses: LicenseInput[] | undefined,
): JsonLdObject[] | undefined {
  if (!licenses?.length) return undefined;

  return licenses
    .filter((l) => l && l.licenseNumber)
    .map((license) => {
      const id: JsonLdObject = {
        "@type": "PropertyValue",
        propertyID: license.authorityName ?? "BusinessLicense",
        name: license.authorityName ?? "Business License",
        value: license.licenseNumber,
      };

      if (license.issuingRegion)
        id.description = `Issuing region: ${license.issuingRegion}`;
      if (license.authorityUrl) id.url = license.authorityUrl;
      if (license.validThrough) id.validThrough = license.validThrough;

      return id;
    });
}

function toAddress(address: PostalAddressInput): JsonLdObject {
  const normalized: JsonLdObject = {
    "@type": "PostalAddress",
    addressCountry: address.addressCountry,
  };

  if (address.streetAddress) normalized.streetAddress = address.streetAddress;
  if (address.addressLocality)
    normalized.addressLocality = address.addressLocality;
  if (address.addressRegion) normalized.addressRegion = address.addressRegion;
  if (address.postalCode) normalized.postalCode = address.postalCode;

  return normalized;
}

function toGeo(geo: GeoCoordinatesInput | undefined): JsonLdObject | undefined {
  if (!geo) return undefined;

  const out: JsonLdObject = {
    "@type": "GeoCoordinates",
    latitude: geo.latitude,
    longitude: geo.longitude,
  };

  if (typeof geo.elevation === "number") out.elevation = geo.elevation;

  return out;
}

export function buildLocalBusinessServiceJsonLdV2(
  input: LocalBusinessSchemaInput,
): JsonLdObject {
  const baseId = normalizeBaseId(input.baseId ?? input.canonicalUrl);
  const localBusinessId = `${baseId}#localbusiness`;

  const globalHours = toOpeningHoursSpecification(input.operatingHours ?? []);
  const globalAreaServed = toAreaServedPlaces(input.serviceAreas);
  const identifiers = toIdentifierProperties(input.licenses);

  const serviceNodes = input.services
    .filter((service) => service && service.name.trim().length > 0)
    .map((service, index) => {
      const serviceSlug = normalizeServiceId(service.id ?? service.name);
      const serviceId = `${baseId}#service-${serviceSlug || index + 1}`;
      const serviceHours = toOpeningHoursSpecification(
        service.hoursAvailable ?? [],
      );
      const serviceArea =
        toAreaServedPlaces(service.areaServed) ?? globalAreaServed;

      const serviceNode: JsonLdObject = {
        "@type": "Service",
        "@id": serviceId,
        name: service.name,
        provider: { "@id": localBusinessId },
      };

      if (service.description) serviceNode.description = service.description;
      if (service.serviceType) serviceNode.serviceType = service.serviceType;
      if (service.category) serviceNode.category = service.category;
      if (service.termsOfService)
        serviceNode.termsOfService = service.termsOfService;
      if (service.audienceType) {
        serviceNode.audience = {
          "@type": "Audience",
          audienceType: service.audienceType,
        };
      }
      if (serviceArea?.length) serviceNode.areaServed = serviceArea;
      if (serviceHours.length > 0) serviceNode.hoursAvailable = serviceHours;

      if (service.offers?.length) {
        serviceNode.offers = service.offers.map((offer, offerIndex) => {
          const offerNode: JsonLdObject = {
            "@type": "Offer",
            "@id": `${serviceId}#offer-${offerIndex + 1}`,
            itemOffered: { "@id": serviceId },
          };

          if (offer.name) offerNode.name = offer.name;
          if (offer.description) offerNode.description = offer.description;
          if (offer.price != null) offerNode.price = offer.price;
          offerNode.priceCurrency = offer.priceCurrency ?? "USD";
          if (offer.availability) offerNode.availability = offer.availability;
          if (offer.url) offerNode.url = offer.url;

          return offerNode;
        });
      }

      return serviceNode;
    });

  const localBusinessNode: JsonLdObject = {
    "@type": input.businessType ?? "LocalBusiness",
    "@id": localBusinessId,
    name: input.name,
    url: input.canonicalUrl,
    mainEntityOfPage: input.canonicalUrl,
    address: toAddress(input.address),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${input.name} Services`,
      itemListElement: serviceNodes.map((serviceNode, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@id": serviceNode["@id"] },
      })),
    },
  };

  if (input.alternateName)
    localBusinessNode.alternateName = input.alternateName;
  if (input.description) localBusinessNode.description = input.description;
  if (input.slogan) localBusinessNode.slogan = input.slogan;
  if (input.image?.length) localBusinessNode.image = input.image;
  if (input.logo) localBusinessNode.logo = input.logo;
  if (input.telephone) localBusinessNode.telephone = input.telephone;
  if (input.email) localBusinessNode.email = input.email;
  if (input.priceRange) localBusinessNode.priceRange = input.priceRange;
  if (input.currenciesAccepted?.length) {
    localBusinessNode.currenciesAccepted = input.currenciesAccepted.join(", ");
  }
  if (input.paymentAccepted?.length) {
    localBusinessNode.paymentAccepted = input.paymentAccepted.join(", ");
  }
  if (input.sameAs?.length) localBusinessNode.sameAs = input.sameAs;
  if (input.foundingDate) localBusinessNode.foundingDate = input.foundingDate;

  const geo = toGeo(input.geo);
  if (geo) localBusinessNode.geo = geo;

  if (globalHours.length > 0)
    localBusinessNode.openingHoursSpecification = globalHours;
  if (globalAreaServed?.length) localBusinessNode.areaServed = globalAreaServed;
  if (identifiers?.length) localBusinessNode.identifier = identifiers;

  const graph = [localBusinessNode, ...serviceNodes];

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": graph,
  };
}
