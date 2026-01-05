// Fetch all IANA RDAP bootstrap files and save locally
const BASE_URL = "https://data.iana.org/rdap";
const OUTPUT_DIR = "resources/data.iana.org/rdap";
const FILES = ["dns.json", "ipv4.json", "ipv6.json", "asn.json"];

// Create output directory
await Deno.mkdir(OUTPUT_DIR, { recursive: true });

// Fetch and save each file
for (const file of FILES) {
  console.log(`Fetching ${file}...`);
  const response = await fetch(`${BASE_URL}/${file}`);

  if (!response.ok) {
    console.error(`Failed to fetch ${file}: ${response.status}`);
    continue;
  }

  const data = await response.text();
  await Deno.writeTextFile(`${OUTPUT_DIR}/${file}`, data);
  console.log(`Saved ${file}`);
}

console.log("Done.");
