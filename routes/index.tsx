import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import RdapLookup from "../islands/RdapLookup.tsx";

export default define.page(function Home() {
  return (
    <div class="min-h-screen bg-[#fafafa]">
      <Head>
        <title>RDAP Domain Lookup</title>
      </Head>
      <div class="px-6 md:px-12 py-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-2xl font-normal text-[#111] tracking-tight mb-2">
            RDAP Domain Lookup
          </h1>
          <p class="text-[#666] text-sm mb-8">
            Look up domain registration data using RDAP (Registration Data
            Access Protocol). RDAP is the modern replacement for WHOIS,
            providing standardized access to domain information.
          </p>
          <RdapLookup />
        </div>
      </div>
    </div>
  );
});
