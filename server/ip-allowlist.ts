import net from "node:net";

const IPV4_MAPPED_IPV6_PREFIX = "::ffff:";

export function createIpAllowlist(additionalAllowedIps: readonly string[] = []): net.BlockList {
  const allowlist = new net.BlockList();
  allowlist.addSubnet("127.0.0.0", 8, "ipv4");
  allowlist.addAddress("::1", "ipv6");
  allowlist.addSubnet("100.64.0.0", 10, "ipv4");
  allowlist.addSubnet("fd7a:115c:a1e0::", 48, "ipv6");

  for (const entry of additionalAllowedIps) {
    addIpRange(allowlist, entry);
  }

  return allowlist;
}

export function isAllowedAddress(
  allowlist: net.BlockList,
  address: string | undefined,
): boolean {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) {
    return false;
  }

  const family = net.isIPv4(normalizedAddress)
    ? "ipv4"
    : net.isIPv6(normalizedAddress)
      ? "ipv6"
      : null;

  return family ? allowlist.check(normalizedAddress, family) : false;
}

export function validateIpRange(entry: string): string {
  const normalizedEntry = entry.trim();
  const [address, prefix] = normalizedEntry.split("/");
  if (
    !address
    || normalizedEntry.split("/").length > 2
    || !isValidAddress(address)
    || (prefix !== undefined && !isValidPrefix(prefix, address))
  ) {
    throw new Error(`"${entry}" is not a valid IP address or CIDR range.`);
  }

  return net.isIPv6(address) ? normalizedEntry.toLowerCase() : normalizedEntry;
}

function addIpRange(allowlist: net.BlockList, entry: string) {
  const [address, prefix] = entry.split("/");
  const family = net.isIPv4(address) ? "ipv4" : "ipv6";

  if (prefix === undefined) {
    allowlist.addAddress(address, family);
    return;
  }

  allowlist.addSubnet(address, Number(prefix), family);
}

function normalizeAddress(address: string | undefined): string | null {
  if (!address) {
    return null;
  }

  const withoutZone = address.split("%", 1)[0];
  if (!withoutZone) {
    return null;
  }

  const mappedAddress = withoutZone.toLowerCase().startsWith(IPV4_MAPPED_IPV6_PREFIX)
    ? withoutZone.slice(IPV4_MAPPED_IPV6_PREFIX.length)
    : withoutZone;

  return mappedAddress;
}

function isValidAddress(address: string): boolean {
  return net.isIP(address) !== 0;
}

function isValidPrefix(prefix: string, address: string): boolean {
  if (!/^\d+$/.test(prefix)) {
    return false;
  }

  const maximum = net.isIPv4(address) ? 32 : 128;
  return Number(prefix) <= maximum;
}
