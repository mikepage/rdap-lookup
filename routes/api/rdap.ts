import { define } from "../../utils.ts";

interface RdapEntity {
  roles?: string[];
  publicIds?: Array<{ type: string; identifier: string }>;
  vcardArray?: [
    string,
    Array<[string, Record<string, unknown>, string, string | string[]]>,
  ];
}

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapNameserver {
  ldhName: string;
  objectClassName: string;
}

interface RdapResponse {
  ldhName: string;
  handle?: string;
  status?: string[];
  events?: RdapEvent[];
  nameservers?: RdapNameserver[];
  entities?: RdapEntity[];
  secureDNS?: {
    delegationSigned?: boolean;
    dsData?: Array<{
      keyTag: number;
      algorithm: number;
      digestType: number;
      digest: string;
    }>;
  };
  links?: Array<{
    rel: string;
    href: string;
    type?: string;
  }>;
}

function getTld(domain: string): string | null {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

function getRdapUrl(domain: string): string | null {
  const tld = getTld(domain);
  if (tld === "com" || tld === "net") {
    return `https://rdap.verisign.com/${tld}/v1/domain/${domain}`;
  }
  return null;
}

function extractRegistrar(entities?: RdapEntity[]): string | null {
  if (!entities) return null;
  const registrarEntity = entities.find((e) => e.roles?.includes("registrar"));
  if (!registrarEntity?.vcardArray) return null;

  const vcard = registrarEntity.vcardArray[1];
  const fnEntry = vcard?.find((entry) => entry[0] === "fn");
  if (fnEntry && typeof fnEntry[3] === "string") {
    return fnEntry[3];
  }
  return null;
}

function extractIanaId(entities?: RdapEntity[]): string | null {
  if (!entities) return null;
  const registrarEntity = entities.find((e) => e.roles?.includes("registrar"));
  if (!registrarEntity?.publicIds) return null;

  const ianaId = registrarEntity.publicIds.find(
    (id) => id.type === "IANA Registrar ID",
  );
  return ianaId?.identifier || null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const domain = url.searchParams.get("domain")?.trim().toLowerCase();

    if (!domain) {
      return Response.json(
        { success: false, error: "Domain parameter is required" },
        { status: 400 },
      );
    }

    // Validate domain format
    const domainRegex =
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(domain)) {
      return Response.json(
        { success: false, error: "Invalid domain format" },
        { status: 400 },
      );
    }

    const rdapUrl = getRdapUrl(domain);
    if (!rdapUrl) {
      const tld = getTld(domain);
      return Response.json(
        {
          success: false,
          error:
            `TLD ".${tld}" is not supported. Only .com and .net domains are supported via Verisign RDAP.`,
        },
        { status: 400 },
      );
    }

    const startTime = performance.now();

    try {
      const response = await fetch(rdapUrl, {
        headers: {
          Accept: "application/rdap+json",
        },
      });

      const queryTime = Math.round(performance.now() - startTime);

      if (response.status === 404) {
        return Response.json({
          success: false,
          error: `Domain "${domain}" not found in RDAP registry`,
          queryTime,
        });
      }

      if (!response.ok) {
        return Response.json({
          success: false,
          error: `RDAP lookup failed with status ${response.status}`,
          queryTime,
        });
      }

      const data: RdapResponse = await response.json();

      // Parse and structure the response
      const result = {
        success: true,
        domain: data.ldhName,
        handle: data.handle || null,
        status: data.status || [],
        queryTime,
        events: {
          registration: null as string | null,
          expiration: null as string | null,
          lastChanged: null as string | null,
          lastUpdateOfRdapDatabase: null as string | null,
        },
        nameservers: data.nameservers?.map((ns) => ns.ldhName) || [],
        registrar: extractRegistrar(data.entities),
        ianaId: extractIanaId(data.entities),
        dnssec: {
          delegationSigned: data.secureDNS?.delegationSigned || false,
          dsData: data.secureDNS?.dsData || [],
        },
        rawResponse: data,
      };

      // Extract events
      if (data.events) {
        for (const event of data.events) {
          switch (event.eventAction) {
            case "registration":
              result.events.registration = formatDate(event.eventDate);
              break;
            case "expiration":
              result.events.expiration = formatDate(event.eventDate);
              break;
            case "last changed":
              result.events.lastChanged = formatDate(event.eventDate);
              break;
            case "last update of RDAP database":
              result.events.lastUpdateOfRdapDatabase = formatDate(
                event.eventDate,
              );
              break;
          }
        }
      }

      return Response.json(result);
    } catch (error) {
      const queryTime = Math.round(performance.now() - startTime);
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : "RDAP lookup failed",
        queryTime,
      });
    }
  },
});
