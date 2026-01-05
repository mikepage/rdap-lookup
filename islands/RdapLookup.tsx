import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface RdapResult {
  success: boolean;
  domain: string;
  handle: string | null;
  status: string[];
  queryTime: number;
  rdapServer: string;
  events: {
    registration: string | null;
    expiration: string | null;
    lastChanged: string | null;
    lastUpdateOfRdapDatabase: string | null;
  };
  nameservers: string[];
  registrar: string | null;
  ianaId: string | null;
  dnssec: {
    delegationSigned: boolean;
    dsData: Array<{
      keyTag: number;
      algorithm: number;
      digestType: number;
      digest: string;
    }>;
  };
}

function parseHash(hash: string): string | null {
  const match = hash.match(/^#(.+?)\/?\s*$/);
  if (!match) return null;
  return match[1];
}

function updateHash(domain: string) {
  if (domain) {
    globalThis.history.replaceState(null, "", `#${domain}`);
  } else {
    globalThis.history.replaceState(null, "", globalThis.location.pathname);
  }
}

function getStatusColor(status: string): string {
  if (status.includes("prohibited")) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
  if (status.includes("active") || status.includes("ok")) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (status.includes("pending") || status.includes("transfer")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (status.includes("redemption") || status.includes("hold")) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function formatStatus(status: string): string {
  return status
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function RdapLookup() {
  const domain = useSignal("");
  const isLoading = useSignal(false);
  const result = useSignal<RdapResult | null>(null);
  const error = useSignal<string | null>(null);
  const initialLoadDone = useSignal(false);

  const handleLookup = async () => {
    error.value = null;
    result.value = null;

    const domainValue = domain.value.trim().toLowerCase();
    if (!domainValue) {
      error.value = "Please enter a domain name";
      return;
    }

    isLoading.value = true;

    try {
      const params = new URLSearchParams({ domain: domainValue });
      const response = await fetch(`/api/rdap?${params}`);
      const data = await response.json();

      if (!data.success) {
        error.value = data.error || "RDAP lookup failed";
        return;
      }

      result.value = data;
    } catch {
      error.value = "Failed to perform RDAP lookup";
    } finally {
      isLoading.value = false;
    }
  };

  const handleClear = () => {
    domain.value = "";
    result.value = null;
    error.value = null;
    updateHash("");
  };

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(globalThis.location.hash);
      if (parsed) {
        domain.value = parsed;
        if (!initialLoadDone.value) {
          initialLoadDone.value = true;
          handleLookup();
        }
      } else {
        initialLoadDone.value = true;
      }
    };

    handleHashChange();

    globalThis.addEventListener("hashchange", handleHashChange);
    return () => globalThis.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (initialLoadDone.value) {
      updateHash(domain.value.trim());
    }
  }, [domain.value]);

  return (
    <div class="w-full">
      {/* Input Section */}
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Domain Lookup</h2>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Domain Name
          </label>
          <input
            type="text"
            value={domain.value}
            onInput={(
              e,
            ) => (domain.value = (e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
            placeholder="example.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">
            Supports all TLDs with RDAP endpoints via IANA bootstrap registry
          </p>
        </div>

        {/* Action Buttons */}
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleLookup}
            disabled={!domain.value.trim() || isLoading.value}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading.value ? "Looking up..." : "Lookup Domain"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error.value && (
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-600">{error.value}</p>
        </div>
      )}

      {/* Results */}
      {result.value && (
        <div class="space-y-6">
          {/* Domain Summary */}
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">
              Domain Information
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-gray-500">Domain Name</div>
                <div class="font-mono text-lg">{result.value.domain}</div>
              </div>
              {result.value.handle && (
                <div>
                  <div class="text-sm text-gray-500">Registry Handle</div>
                  <div class="font-mono">{result.value.handle}</div>
                </div>
              )}
              {result.value.registrar && (
                <div>
                  <div class="text-sm text-gray-500">Registrar</div>
                  <div class="font-mono text-sm">{result.value.registrar}</div>
                </div>
              )}
              {result.value.ianaId && (
                <div>
                  <div class="text-sm text-gray-500">IANA ID</div>
                  <div class="font-mono">{result.value.ianaId}</div>
                </div>
              )}
            </div>

            <div class="text-sm text-gray-500 mt-4 space-y-1">
              <div>Query Time: {result.value.queryTime}ms</div>
              <div>
                RDAP Server:{" "}
                <span class="font-mono text-xs">{result.value.rdapServer}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          {result.value.status.length > 0 && (
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">
                Domain Status
              </h3>
              <div class="flex flex-wrap gap-2">
                {result.value.status.map((status, index) => (
                  <span
                    key={index}
                    class={`px-3 py-1 rounded-md border text-sm ${
                      getStatusColor(
                        status,
                      )
                    }`}
                  >
                    {formatStatus(status)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Important Dates */}
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">
              Important Dates
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.value.events.registration && (
                <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div class="text-sm text-gray-500">Registration Date</div>
                  <div class="font-mono">
                    {result.value.events.registration}
                  </div>
                </div>
              )}
              {result.value.events.expiration && (
                <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div class="text-sm text-gray-500">Expiration Date</div>
                  <div class="font-mono">{result.value.events.expiration}</div>
                </div>
              )}
              {result.value.events.lastChanged && (
                <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div class="text-sm text-gray-500">Last Changed</div>
                  <div class="font-mono">{result.value.events.lastChanged}</div>
                </div>
              )}
              {result.value.events.lastUpdateOfRdapDatabase && (
                <div class="border border-gray-200 rounded-md p-3 bg-gray-50">
                  <div class="text-sm text-gray-500">Database Updated</div>
                  <div class="font-mono">
                    {result.value.events.lastUpdateOfRdapDatabase}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nameservers */}
          {result.value.nameservers.length > 0 && (
            <div class="bg-white rounded-lg shadow p-6">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">
                Nameservers
              </h3>
              <div class="space-y-2">
                {result.value.nameservers.map((ns, index) => (
                  <div
                    key={index}
                    class="font-mono text-sm bg-blue-50 text-blue-800 px-3 py-2 rounded-md border border-blue-200"
                  >
                    {ns}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DNSSEC */}
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">DNSSEC</h3>
            <div class="mb-4">
              <span
                class={`px-3 py-1 rounded-md border text-sm ${
                  result.value.dnssec.delegationSigned
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-gray-100 text-gray-800 border-gray-200"
                }`}
              >
                {result.value.dnssec.delegationSigned
                  ? "Delegation Signed"
                  : "Not Signed"}
              </span>
            </div>
            {result.value.dnssec.dsData.length > 0 && (
              <div class="space-y-3">
                <h4 class="text-sm font-medium text-gray-700">DS Records</h4>
                {result.value.dnssec.dsData.map((ds, index) => (
                  <div
                    key={index}
                    class="border border-gray-200 rounded-md p-3 bg-gray-50"
                  >
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span class="text-gray-500">Key Tag:</span>
                        <span class="font-mono">{ds.keyTag}</span>
                      </div>
                      <div>
                        <span class="text-gray-500">Algorithm:</span>
                        <span class="font-mono">{ds.algorithm}</span>
                      </div>
                      <div>
                        <span class="text-gray-500">Digest Type:</span>
                        <span class="font-mono">{ds.digestType}</span>
                      </div>
                    </div>
                    <div class="mt-2 text-sm">
                      <span class="text-gray-500">Digest:</span>
                      <span class="font-mono text-xs break-all">
                        {ds.digest}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reference Section */}
      <details class="bg-white rounded-lg shadow mt-6">
        <summary class="p-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
          About RDAP
        </summary>
        <div class="p-4 pt-0 border-t">
          <div class="text-sm text-gray-700 space-y-3">
            <p>
              <strong>RDAP</strong>{" "}
              (Registration Data Access Protocol) is the successor to WHOIS,
              providing standardized access to domain registration data in a
              structured JSON format.
            </p>
            <p>
              <strong>Key advantages over WHOIS:</strong>
            </p>
            <ul class="list-disc list-inside ml-4 space-y-1">
              <li>Standardized data format (JSON)</li>
              <li>Internationalized domain name support</li>
              <li>Secure access via HTTPS</li>
              <li>RESTful API design</li>
              <li>Built-in support for pagination</li>
            </ul>
            <p class="text-gray-500 text-xs mt-4">
              This tool uses the IANA RDAP bootstrap registry to find the
              appropriate RDAP server for any supported TLD.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
